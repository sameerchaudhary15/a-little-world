/* The admin login form. Holds no dashboard code and no data. */
(function () {
  const form = document.getElementById("adminLogin"), err = document.getElementById("adminErr");
  const setup = form.dataset.setup === "1";
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector("button"); btn.disabled = true; err.textContent = "";
    try {
      const body = { password: document.getElementById("adminPw").value };
      if (setup) body.setupKey = document.getElementById("adminKey")?.value || "";
      await UI.api("POST", setup ? "/api/auth/setup" : "/api/auth/login", body);
      location.reload();
    } catch (x) { err.textContent = x.message; btn.disabled = false; }
  };
})();
