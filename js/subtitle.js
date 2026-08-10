(function(){
  var text = "假若你的天空潸然雨落";
  var i = 0;
  var forward = true;
  var el = document.getElementById("site-info");
  if (!el) return;
  var sub = document.createElement("div");
  sub.id = "site-subtitle";
  el.appendChild(sub);
  function loop(){
    if (forward) {
      if (i < text.length) {
        sub.textContent = text.substring(0, i+1) + "|";
        i++;
        setTimeout(loop, 100);
      } else {
        sub.innerHTML = text + '<span class="cursor">|</span>';
        forward = false;
        setTimeout(loop, 2000);
      }
    } else {
      if (i > 0) {
        i--;
        sub.textContent = text.substring(0, i) + "|";
        setTimeout(loop, 60);
      } else {
        forward = true;
        setTimeout(loop, 800);
      }
    }
  }
  loop();
})();
