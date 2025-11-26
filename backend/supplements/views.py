from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from .models import (
    Product, Purchase, PurchaseItem, CostLayer,
    Customer, Sale, SaleItem, InventoryTransaction,
    SystemSettings
)
from .serializers import (
    ProductSerializer, PurchaseSerializer,
    PurchaseItemSerializer, CustomerSerializer, SaleSerializer, SaleItemSerializer,
    InventoryTransactionSerializer, SystemSettingsSerializer
)


class SystemSettingsViewSet(viewsets.ViewSet):
    """
    ViewSet for system settings (singleton).
    Only supports GET and PUT operations.
    """
    def list(self, request):
        """Get system settings"""
        settings = SystemSettings.get_settings()
        serializer = SystemSettingsSerializer(settings)
        return Response(serializer.data)

    def update(self, request, pk=None):
        """Update system settings"""
        settings = SystemSettings.get_settings()
        serializer = SystemSettingsSerializer(settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

    @action(detail=False, methods=['get'])
    def low_stock(self, request):
        """Get products with low stock levels"""
        low_stock_products = [p for p in self.queryset if p.is_low_stock]
        serializer = self.get_serializer(low_stock_products, many=True)
        return Response(serializer.data)


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer


class PurchaseViewSet(viewsets.ModelViewSet):
    queryset = Purchase.objects.all()
    serializer_class = PurchaseSerializer

    @action(detail=True, methods=['post'])
    def receive(self, request, pk=None):
        """Mark purchase as received and update inventory"""
        purchase = self.get_object()

        if purchase.status == 'received':
            return Response(
                {'error': 'Purchase already received'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Update purchase status
            purchase.status = 'received'
            purchase.save()

            # Update inventory for each item
            for item in purchase.items.all():
                product = item.product
                product.current_stock += item.quantity

                # Update last purchase info
                product.last_purchase_cost = item.unit_cost
                product.last_purchase_date = purchase.purchase_date
                product.save()

                # Get exchange rate for USD to GTQ conversion
                settings = SystemSettings.get_settings()
                unit_cost_gtq = item.unit_cost * settings.usd_to_gtq_rate

                # Create cost layer for FIFO tracking (with GTQ conversion)
                CostLayer.objects.create(
                    product=product,
                    purchase_item=item,
                    unit_cost=item.unit_cost,  # USD cost
                    unit_cost_gtq=unit_cost_gtq,  # GTQ cost (converted)
                    base_unit_cost=item.unit_cost,
                    quantity_remaining=item.quantity,
                    original_quantity=item.quantity,
                    logistics_allocated=False
                )

                # Update product average cost
                product.update_average_cost()

                # Create inventory transaction
                InventoryTransaction.objects.create(
                    product=product,
                    transaction_type='purchase',
                    quantity_change=item.quantity,
                    quantity_after=product.current_stock,
                    reference_id=purchase.id,
                    notes=f'Purchase #{purchase.id} received'
                )

        serializer = self.get_serializer(purchase)
        return Response(serializer.data)


class PurchaseItemViewSet(viewsets.ModelViewSet):
    queryset = PurchaseItem.objects.all()
    serializer_class = PurchaseItemSerializer


class SaleViewSet(viewsets.ModelViewSet):
    queryset = Sale.objects.all()
    serializer_class = SaleSerializer

    def create(self, request, *args, **kwargs):
        """Create sale and update inventory"""
        # Note: This is a simplified version. In production, you'd want to
        # handle the items in the same request and validate stock levels
        return super().create(request, *args, **kwargs)

    @action(detail=False, methods=['get'])
    def cost_report(self, request):
        """
        Generate cost report by product for a date range.
        Query params: start_date, end_date (YYYY-MM-DD format)
        Returns aggregated sales cost data for paying the provider.
        """
        from django.db.models import Sum, F
        from decimal import Decimal
        from datetime import datetime

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if not start_date or not end_date:
            return Response(
                {'error': 'Both start_date and end_date parameters are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
        except ValueError:
            return Response(
                {'error': 'Dates must be in YYYY-MM-DD format'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if start > end:
            return Response(
                {'error': 'Start date must be before or equal to end date'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get all sale items from completed sales in the date range
        sale_items = SaleItem.objects.filter(
            sale__status='completed',
            sale__sale_date__gte=start,
            sale__sale_date__lte=end
        ).select_related('product')

        # Aggregate by product
        product_data = sale_items.values(
            'product__id',
            'product__product_name',
            'product__brand_name'
        ).annotate(
            quantity_sold=Sum('quantity'),
            total_cost=Sum(F('quantity') * F('unit_cost')),
            total_revenue=Sum(F('quantity') * F('unit_price'))
        ).order_by('product__product_name')

        # Format response
        products = []
        total_quantity = Decimal('0')
        total_cost = Decimal('0')
        total_revenue = Decimal('0')

        for item in product_data:
            qty = item['quantity_sold'] or Decimal('0')
            cost = item['total_cost'] or Decimal('0')
            revenue = item['total_revenue'] or Decimal('0')
            avg_unit_cost = cost / qty if qty > 0 else Decimal('0')
            profit = revenue - cost

            products.append({
                'product_id': item['product__id'],
                'product_name': item['product__product_name'],
                'brand_name': item['product__brand_name'] or '',
                'quantity_sold': float(qty),
                'avg_unit_cost': float(avg_unit_cost),
                'total_cost': float(cost),
                'total_revenue': float(revenue),
                'profit': float(profit)
            })

            total_quantity += qty
            total_cost += cost
            total_revenue += revenue

        return Response({
            'start_date': start_date,
            'end_date': end_date,
            'products': products,
            'totals': {
                'total_quantity': float(total_quantity),
                'total_cost': float(total_cost),
                'total_revenue': float(total_revenue),
                'total_profit': float(total_revenue - total_cost)
            }
        })


class SaleItemViewSet(viewsets.ModelViewSet):
    queryset = SaleItem.objects.all()
    serializer_class = SaleItemSerializer

    # Note: FIFO cost calculation and inventory updates are handled by signals in signals.py
    # - pre_save signal: calculates unit_cost using FIFO
    # - post_save signal: consumes cost layers and updates inventory
    # - post_delete signal: restores inventory when sale items are deleted

    def create(self, request, *args, **kwargs):
        """Create sale item with atomic transaction to prevent race conditions"""
        product_id = request.data.get('product')

        with transaction.atomic():
            # Lock the product row to prevent concurrent modifications
            product = Product.objects.select_for_update().get(id=product_id)
            quantity = request.data.get('quantity', 0)

            # Re-validate stock with locked row
            if float(quantity) > float(product.current_stock):
                return Response(
                    {'error': f'Insufficient stock for {product.product_name}. Available: {product.current_stock}, Requested: {quantity}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            return super().create(request, *args, **kwargs)


class InventoryTransactionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = InventoryTransaction.objects.all()
    serializer_class = InventoryTransactionSerializer
