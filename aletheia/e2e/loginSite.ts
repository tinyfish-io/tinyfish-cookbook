import { createServer } from "node:http";

/**
 * A pretend site for sign-in tests, one flow per path. Each page is plain HTML with a little script,
 * built the way real login pages are: a field or two, then the next step swapped in by JavaScript.
 */
const STYLE =
  "<style>body{font:16px sans-serif;margin:40px}input,button{display:block;margin:8px 0}</style>";

interface Screen {
  /** Words on the page, which is where a site says where it sent a code. */
  text?: string;
  html: string;
}

type Flow = Record<string, Screen>;

const SUBMIT = (label: string) => `<button type="submit">${label}</button>`;
const CODE_FIELD = (length: number) =>
  `<label>Enter code <input name="code" autocomplete="one-time-code" maxlength="${length}"></label>`;

const SIGNED_IN: Screen = {
  html: `<h1>Your orders</h1><button>Log out</button>`,
};

interface Site {
  start: string;
  flow: Flow;
  rules: string;
  /** Where the flow lives on the site, when that is not its home page. */
  at?: string;
  /** Plain pages at other addresses, the way a site has more than its login. */
  pages?: Record<string, string>;
}

const FOLLOW_LINKS = `<footer><a href="https://facebook.test/">facebook</a> <a href="https://linkedin.test/">LinkedIn</a></footer>`;

const EMAIL_IN: Flow = {
  email: { html: `<label>Email <input type="email" name="email"></label>${SUBMIT("Continue")}` },
  in: SIGNED_IN,
};

const FLOWS: Record<string, Site> = {
  "email-password": {
    start: "email",
    rules: `email: () => "password", password: (v) => v === "right-password" ? "in" : err("Invalid password.")`,
    flow: {
      email: {
        html: `<label>Email <input type="email" name="email"></label>${SUBMIT("Continue")}`,
      },
      password: {
        html: `<label>Password <input type="password" name="password"></label>${SUBMIT("Sign in")}`,
      },
      in: SIGNED_IN,
    },
  },
  "email-password-together": {
    start: "both",
    rules: `both: () => "in"`,
    flow: {
      both: {
        html: `<label>Email <input type="email" name="email"></label>
          <label>Password <input type="password" name="password"></label>${SUBMIT("Sign in")}`,
      },
      in: SIGNED_IN,
    },
  },
  "phone-code-4": phoneCode(4, "1234"),
  "phone-code-6": phoneCode(6, "123456"),
  "phone-code-8": phoneCode(8, "12345678"),
  "split-boxes": {
    start: "phone",
    rules: `phone: () => "boxes", boxes: (v) => v === "4821" ? "in" : err("Incorrect code")`,
    flow: {
      phone: {
        html: `<label>Mobile number <input type="tel" name="phone"></label>${SUBMIT("Send code")}`,
      },
      boxes: {
        text: "We sent a code to ******4321",
        html: `${[1, 2, 3, 4].map((box) => `<input class="box" maxlength="1" inputmode="numeric" aria-label="Digit ${box}">`).join("")}${SUBMIT("Verify")}`,
      },
      in: SIGNED_IN,
    },
  },
  "letters-code": {
    start: "email",
    rules: `email: () => "code", code: (v) => v === "aB3dE9" ? "in" : err("That code is not valid")`,
    flow: {
      email: {
        html: `<label>Email <input type="email" name="email"></label>${SUBMIT("Continue")}`,
      },
      code: {
        text: "We emailed a code to r***@mail.test",
        html: `<label>Enter code <input name="code" autocomplete="one-time-code"></label>${SUBMIT("Verify")}`,
      },
      in: SIGNED_IN,
    },
  },
  "method-choice": {
    start: "email",
    rules: `email: () => "choose", code: (v) => v === "123456" ? "in" : err("Incorrect code")`,
    flow: {
      email: {
        html: `<label>Email <input type="email" name="email"></label>${SUBMIT("Continue")}`,
      },
      choose: {
        text: "How should we send your code?",
        html: `<button type="button" data-go="code">Text me</button>
          <button type="button" data-go="code">Email me</button>`,
      },
      code: { text: "We sent you a code", html: `${CODE_FIELD(6)}${SUBMIT("Verify")}` },
      in: SIGNED_IN,
    },
  },
  authenticator: {
    start: "email",
    rules: `email: () => "password", password: () => "second", second: (v) => v === "654321" ? "in" : err("Incorrect code")`,
    flow: {
      email: {
        html: `<label>Email <input type="email" name="email"></label>${SUBMIT("Continue")}`,
      },
      password: {
        html: `<label>Password <input type="password" name="password"></label>${SUBMIT("Sign in")}`,
      },
      second: {
        text: "Two-step verification. Open your authenticator app.",
        html: `${CODE_FIELD(6)}<label><input type="checkbox" checked> Trust this device</label>${SUBMIT("Verify")}`,
      },
      in: SIGNED_IN,
    },
  },
  resend: {
    start: "phone",
    rules: `phone: () => "code", code: (v) => v === String(window.sent ?? "111111") ? "in" : err("Incorrect code")`,
    flow: {
      phone: { html: `<label>Phone <input type="tel" name="phone"></label>${SUBMIT("Send OTP")}` },
      code: {
        text: "We sent a code to +1 ******5521",
        html: `${CODE_FIELD(6)}${SUBMIT("Verify")}
          <button type="button" onclick="window.sent = 222222; document.title = 'resent'">Resend code</button>`,
      },
      in: SIGNED_IN,
    },
  },
  captcha: {
    start: "email",
    rules: `email: () => "in"`,
    flow: {
      email: {
        html: `<label>Email <input type="email" name="email"></label>
          <div id="check">Verify you are human <button type="button" style="position:fixed;inset:0 0 auto 0;height:40%;margin:0;width:100%" onclick="document.getElementById('check').remove()">Ok</button></div>
          ${SUBMIT("Continue")}`,
      },
      in: SIGNED_IN,
    },
  },
  google: {
    start: "only",
    rules: "",
    flow: {
      only: {
        html: `<button type="button" onclick="document.body.innerHTML = '<h1>Your orders</h1><button>Log out</button>'">Continue with Google</button>`,
      },
    },
  },
  "behind-a-button": {
    start: "home",
    rules: `email: () => "in"`,
    flow: {
      home: {
        html: `<h1>Welcome</h1><label>Search for a dish <input name="q"></label>
          <button type="button" data-go="email">Log in</button>`,
      },
      email: {
        html: `<label>Email <input type="email" name="email"></label>${SUBMIT("Continue")}`,
      },
      in: SIGNED_IN,
    },
  },
  "blocked-home": {
    start: "email",
    rules: `email: () => "in"`,
    flow: EMAIL_IN,
    at: "/login",
    pages: {
      "/": "<h1>Sorry, you have been blocked</h1><p>You are unable to access this site.</p>",
    },
  },
  "footer-login": {
    start: "home",
    rules: `email: () => "in"`,
    flow: {
      home: {
        html: `<h1>Plans for every team</h1><label>Search <input name="q"></label>
          <a href="#plans">Plans</a>
          <a href="#" data-go="email">Log into your account</a>${FOLLOW_LINKS}`,
      },
      ...EMAIL_IN,
    },
  },
  "missing-page": {
    start: "email",
    rules: `email: () => "in"`,
    flow: EMAIL_IN,
    at: "/login",
    pages: {
      "/": `<h1>Sorry, we couldn't find that page.</h1><a href="/">Home</a>${FOLLOW_LINKS}`,
    },
  },
};

function phoneCode(length: number, right: string) {
  return {
    start: "phone",
    rules: `phone: () => "code", code: (v) => v === "${right}" ? "in" : err("Incorrect OTP entered.")`,
    flow: {
      phone: { html: `<label>Phone <input type="tel" name="phone"></label>${SUBMIT("Send OTP")}` },
      code: {
        text: "We sent a code to +91 ******4321",
        html: `${CODE_FIELD(length)}${SUBMIT("Verify")}`,
      },
      in: SIGNED_IN,
    },
  };
}

function pageFor(name: string, path: string): string | null {
  const site = FLOWS[name];
  if (!site) return null;
  const other = site.pages?.[path];
  if (other !== undefined) return `<!doctype html><title>${name}</title>${STYLE}${other}`;
  if (path !== (site.at ?? "/")) return null;
  return `<!doctype html><title>${name}</title>${STYLE}<main id="page"></main><script>
    const FLOW = ${JSON.stringify(site.flow)};
    const err = (message) => ({ error: message });
    const RULES = { ${site.rules} };
    let at = ${JSON.stringify(site.start)};
    function draw() {
      const { text, html } = FLOW[at];
      document.getElementById("page").innerHTML =
        "<p>" + (text ?? "") + "</p><p id=problem role=alert></p><form>" + html + "</form>";
      for (const button of document.querySelectorAll("[data-go]")) {
        button.onclick = () => { at = button.dataset.go; draw(); };
      }
      for (const box of document.querySelectorAll(".box")) {
        box.oninput = () => box.nextElementSibling?.focus();
      }
      document.querySelector("form").onsubmit = (event) => {
        event.preventDefault();
        const inputs = [...event.target.querySelectorAll("input:not([type=checkbox])")];
        const value = inputs.map((input) => input.value).join("");
        const next = RULES[at]?.(value);
        if (next?.error) { document.getElementById("problem").textContent = next.error; return; }
        if (next) { at = next; setTimeout(draw, 150); }
      };
    }
    draw();
  </script>`;
}

export function serveLoginSite(port: number): void {
  createServer((request, response) => {
    const [, name = "", ...rest] = new URL(request.url ?? "/", "http://site").pathname.split("/");
    const path = `/${rest.filter(Boolean).join("/")}`;
    if (name === "live") {
      response.writeHead(200, { "Content-Type": "text/html" });
      response.end("<!doctype html><title>live</title>");
      return;
    }
    const page = pageFor(name, path);
    response.writeHead(page ? 200 : 404, { "Content-Type": "text/html" });
    response.end(page ?? "Not found");
  }).listen(port);
}

export const LOGIN_FLOWS = Object.keys(FLOWS);
