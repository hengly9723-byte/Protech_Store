from django.urls import path
from .views import (
    CartView,
    CartItemView,
    CartItemDetailView,
    WishlistView,
    WishlistToggleView,
    WishlistItemDetailView,
)

urlpatterns = [
    # Cart Endpoints
    path('cart', CartView.as_view(), name='cart-root'),
    path('cart/', CartView.as_view(), name='cart-root-slash'),
    path('cart/items', CartItemView.as_view(), name='cart-items'),
    path('cart/items/', CartItemView.as_view(), name='cart-items-slash'),
    path('cart/items/<uuid:id>', CartItemDetailView.as_view(), name='cart-item-detail'),
    path('cart/items/<uuid:id>/', CartItemDetailView.as_view(), name='cart-item-detail-slash'),

    # Wishlist Endpoints
    path('wishlist', WishlistView.as_view(), name='wishlist-root'),
    path('wishlist/', WishlistView.as_view(), name='wishlist-root-slash'),
    path('wishlist/toggle', WishlistToggleView.as_view(), name='wishlist-toggle'),
    path('wishlist/toggle/', WishlistToggleView.as_view(), name='wishlist-toggle-slash'),
    path('wishlist/items/<uuid:id>', WishlistItemDetailView.as_view(), name='wishlist-item-detail'),
    path('wishlist/items/<uuid:id>/', WishlistItemDetailView.as_view(), name='wishlist-item-detail-slash'),
]

