Please update the hero/campaign banner component and layout with the following changes:

1. Clean up the Banner Content:
   - Remove the main title, subtitle, descriptive text, CTA button ("Explore Campaign Deals"), and the 4 feature badge icons (Special Discount, Free Gift, Warranty Support, Fast Delivery).
   - Remove the toggle control in the top-right corner ("Overlay Shelf | Bottom Carousel").
   - Remove the "4 Featured Products" badge.
   - Keep ONLY these 3 badges aligned at the top-left:
     • "Seasonal Fest"
     • "20% OFF"
     • "26d 17h left" (countdown)

2. Fix Banner Responsiveness (Proportional Scaling):
   - Replace any fixed height (e.g., `h-[...]`, `min-h-[...]`, or static pixel heights) with a CSS `aspect-ratio` (e.g., `aspect-[21/9]` or `aspect-[16/6]` in Tailwind CSS).
   - Ensure the banner scales both width and height proportionally across all viewport sizes so the background graphic is never distorted or awkwardly cropped.
   - Scale down the badge padding and font sizes appropriately for mobile viewports.

3. Move "Featured in Pchum Ben" Section to the Bottom:
   - Extract the featured products shelf from being overlaid inside the banner.
   - Position it directly beneath the banner container as its own dedicated section (above "Explore Products").
   - Display the header ("Featured in Pchum Ben" with subtext and "Explore all" link) followed by a 4-column responsive grid/carousel showing the 4 featured product cards with their -20% OFF badges, images, titles, and discount/original prices.
