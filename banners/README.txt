Drop banner PNGs here named by email ID:
  A-01.png, B-01.png, B-02.png, … D-04.png

Recommended:
  • 1200×600 px (retina-ready; rendered at 600×300)
  • PNG or JPG
  • Top-corners get rounded by the email body (14px radius)

The viewer currently uses placehold.co placeholders. To switch to your
real images, open index.html, find:

    function bannerSlot(id, name){

and change the <img src="…"> line to:

    <img src="./banners/${id}.png" …>
