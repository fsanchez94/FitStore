from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SystemSettingsViewSet, ProductViewSet, PurchaseViewSet, PurchaseItemViewSet,
    CustomerViewSet, SaleViewSet, SaleItemViewSet, InventoryTransactionViewSet
)

router = DefaultRouter()
router.register(r'settings', SystemSettingsViewSet, basename='settings')
router.register(r'products', ProductViewSet)
router.register(r'purchases', PurchaseViewSet)
router.register(r'purchase-items', PurchaseItemViewSet)
router.register(r'customers', CustomerViewSet)
router.register(r'sales', SaleViewSet)
router.register(r'sale-items', SaleItemViewSet)
router.register(r'inventory-transactions', InventoryTransactionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
