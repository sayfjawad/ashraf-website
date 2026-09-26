/* Contactformulier: verstuurt naar POST /api/contact en toont het resultaat. */
(function () {
  "use strict";

  var form = document.getElementById("contact-form");
  if (!form) return;

  var melding = document.getElementById("form-msg");
  var knop = form.querySelector('button[type="submit"]');
  var origineel = knop ? knop.textContent : "Verstuur aanvraag";

  function toon(tekst, soort) {
    if (!melding) return;
    melding.hidden = false;
    melding.textContent = tekst;
    melding.className = "form-msg" + (soort ? " " + soort : "");
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();

    var gegevens = {
      naam: (form.naam.value || "").trim(),
      email: (form.email.value || "").trim(),
      bericht: (form.bericht.value || "").trim(),
      website: form.website ? form.website.value : "",
    };

    if (knop) {
      knop.disabled = true;
      knop.textContent = "Versturen…";
    }
    toon("Bezig met versturen…", "");

    fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(gegevens),
    })
      .then(function (r) { return r.json().catch(function () { return { ok: false, fout: "Onverwachte reactie van de server." }; }); })
      .then(function (j) {
        if (j && j.ok) {
          toon(j.boodschap || "Bedankt! Ik neem binnen één werkdag contact met u op.", "goed");
          form.reset();
        } else {
          toon((j && j.fout) || "Er ging iets mis. Mail gerust naar info@ashraf.sdai.nl.", "fout");
        }
      })
      .catch(function () {
        toon("Geen verbinding met de server. Mail gerust naar info@ashraf.sdai.nl.", "fout");
      })
      .then(function () {
        if (knop) {
          knop.disabled = false;
          knop.textContent = origineel;
        }
      });
  });
})();
