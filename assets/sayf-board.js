/* ===================================================================
   Sayf-dossier — interactie
   1. tekent rode draden tussen de pinnen van de kaarten (SVG)
   2. spotlight volgt de cursor over het bord
   3. knoppen: draden aan/uit, bord "schudden"
   Alles vanilla JS, geen dependencies.
   =================================================================== */
(function () {
  "use strict";

  var board = document.getElementById("board");
  if (!board) return;

  var svg = document.getElementById("strings");
  var SVGNS = "http://www.w3.org/2000/svg";

  /* Welke kaarten met elkaar verbonden zijn (id van de <article>).
     De eerste kaart is het "hart" van het bord.                            */
  var HUB = "ev-sayf";
  var CONNECTIES = [
    ["ev-sayf", "ev-gezocht"],
    ["ev-sayf", "ev-cv"],
    ["ev-sayf", "ev-werk"],
    ["ev-sayf", "ev-multicode"],
    ["ev-sayf", "ev-github"],
    ["ev-sayf", "ev-archief"],
    ["ev-sayf", "ev-aboali"],
    ["ev-sayf", "ev-gemeente"],
    ["ev-sayf", "ev-stichting"],
    ["ev-sayf", "ev-netwerk"],
    ["ev-sayf", "ev-tijdlijn"],
    ["ev-netwerk", "ev-stichting"],
    ["ev-multicode", "ev-stichting"],
    ["ev-github", "ev-gemeente"],
    ["ev-ambassadeurs", "ev-stichting"],
    ["ev-tijdlijn", "ev-noot"],
    ["ev-sayf", "ev-verdachten"],
    ["ev-getuigen", "ev-sayf"]
  ];

  function pinVan(id) {
    var kaart = document.getElementById(id);
    if (!kaart) return null;
    return kaart.querySelector(".pin") || kaart;
  }

  function teken() {
    if (!svg) return;
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    var b = board.getBoundingClientRect();
    svg.setAttribute("viewBox", "0 0 " + b.width + " " + b.height);

    CONNECTIES.forEach(function (paar, i) {
      var a = pinVan(paar[0]), c = pinVan(paar[1]);
      if (!a || !c) return;
      var ra = a.getBoundingClientRect(), rc = c.getBoundingClientRect();
      var x1 = ra.left - b.left + ra.width / 2, y1 = ra.top - b.top + ra.height / 2;
      var x2 = rc.left - b.left + rc.width / 2, y2 = rc.top - b.top + rc.height / 2;

      var dx = x2 - x1, dy = y2 - y1;
      var afstand = Math.sqrt(dx * dx + dy * dy);
      var doorzak = Math.min(70, afstand * 0.16);          // hoe verder, hoe dieper de draad hangt
      var zwaai = (i % 2 ? 1 : -1) * Math.min(26, afstand * 0.07);
      var mx = (x1 + x2) / 2 + zwaai, my = (y1 + y2) / 2 + doorzak;

      var pad = document.createElementNS(SVGNS, "path");
      pad.setAttribute("d", "M" + x1.toFixed(1) + " " + y1.toFixed(1) +
                            " Q" + mx.toFixed(1) + " " + my.toFixed(1) +
                            " " + x2.toFixed(1) + " " + y2.toFixed(1));
      svg.appendChild(pad);

      [[x1, y1], [x2, y2]].forEach(function (p) {
        var knoop = document.createElementNS(SVGNS, "circle");
        knoop.setAttribute("cx", p[0].toFixed(1));
        knoop.setAttribute("cy", p[1].toFixed(1));
        knoop.setAttribute("r", "3.2");
        svg.appendChild(knoop);
      });
    });
  }

  function herteken() {
    teken();
    requestAnimationFrame(teken);   // tweede keer: na het herberekenen van de layout
  }

  /* ---------- spotlight + loep ---------- */
  var loep = document.getElementById("loep");

  function beweeg(e) {
    var b = board.getBoundingClientRect();
    var x = e.clientX - b.left, y = e.clientY - b.top;
    board.style.setProperty("--mx", x + "px");
    board.style.setProperty("--my", y + "px");
    if (!loep) return;
    if (e.pointerType !== "touch") board.classList.add("loep-aan");   // geen loep op aanraakschermen
    loep.style.transform = "translate(" + x + "px," + y + "px)";
  }
  function verlaat() { board.classList.remove("loep-aan"); }

  board.addEventListener("pointermove", beweeg);
  board.addEventListener("mousemove", beweeg);      // vangnet voor browsers zonder pointer-events
  board.addEventListener("pointerleave", verlaat);
  board.addEventListener("mouseleave", verlaat);

  /* ---------- hoe lang loopt het onderzoek al? ---------- */
  var dagen = document.getElementById("dagen");
  if (dagen) {
    var start = new Date(2026, 0, 6);                       // oprichtingsakte
    var verschil = Math.floor((Date.now() - start.getTime()) / 86400000);
    dagen.textContent = verschil > 0 ? verschil : 0;
  }

  /* ---------- knoppen ---------- */
  var knopDraden = document.getElementById("knop-draden");
  if (knopDraden) {
    knopDraden.addEventListener("click", function () {
      var uit = svg.classList.toggle("uit");
      knopDraden.setAttribute("aria-pressed", uit ? "false" : "true");
    });
  }

  var knopSchud = document.getElementById("knop-schud");
  if (knopSchud) {
    knopSchud.addEventListener("click", function () {
      document.querySelectorAll(".board-grid .ev").forEach(function (kaart) {
        if (kaart.id === HUB) return;                     // het hart blijft recht hangen
        var hoek = (Math.random() * 4 - 2).toFixed(2);
        kaart.style.setProperty("--rot", hoek + "deg");
      });
      setTimeout(herteken, 260);                          // pas na de animatie opnieuw meten
    });
  }

  /* ---------- opstarten ---------- */
  board.classList.add("board--anim");
  document.querySelectorAll(".board-grid .ev").forEach(function (kaart, i) {
    kaart.style.setProperty("--d", (i * 0.05).toFixed(2) + "s");
  });

  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (items) {
      items.forEach(function (item) {
        if (item.isIntersecting) { board.classList.add("in"); io.disconnect(); }
      });
    }, { threshold: 0.08 });
    io.observe(board);
  } else {
    board.classList.add("in");
  }

  window.addEventListener("load", herteken);
  window.addEventListener("resize", herteken);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(herteken);
  herteken();
})();
