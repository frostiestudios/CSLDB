const svg = document.getElementById("embedmap");
const getTransformParameters = (element) => {
    const transform = element.style.transform;
    let scale = 1,
      x = 0,
      y = 0;
  
    if (transform.includes("scale"))
      scale = parseFloat(transform.slice(transform.indexOf("scale") + 6));
    if (transform.includes("translateX"))
      x = parseInt(transform.slice(transform.indexOf("translateX") + 11));
    if (transform.includes("translateY"))
      y = parseInt(transform.slice(transform.indexOf("translateY") + 11));
  
    return { scale, x, y };
  };
  
  const getTransformString = (scale, x, y) =>
    "scale(" + scale + ") " + "translateX(" + x + "%) translateY(" + y + "%)";
  
  const pan = (direction) => {
    const { scale, x, y } = getTransformParameters(svg);
    let dx = 0,
      dy = 0;
    switch (direction) {
      case "left":
        dx = -3;
        break;
      case "right":
        dx = 3;
        break;
      case "up":
        dy = -3;
        break;
      case "down":
        dy = 3;
        break;
    }
    svg.style.transform = getTransformString(scale, x + dx, y + dy);
  };
  
  const zoom = (direction) => {
    const { scale, x, y } = getTransformParameters(svg);
    let dScale = 0.1;
    if (direction == "out") dScale *= -1;
    if (scale == 0.1 && direction == "out") dScale = 0;
    svg.style.transform = getTransformString(scale + dScale, x, y);
  };
  
  document.getElementById("left-button").onclick = () => pan("left");
  document.getElementById("right-button").onclick = () => pan("right");
  document.getElementById("up-button").onclick = () => pan("up");
  document.getElementById("down-button").onclick = () => pan("down");
  
  document.getElementById("zoom-in-button").onclick = () => zoom("in");
  document.getElementById("zoom-out-button").onclick = () => zoom("out");