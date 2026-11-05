<p align="center">
  <a href="https://aletheia.romitraj.dev"><img src="web/public/favicon.svg" alt="" width="72" height="72" /></a>
</p>

<h1 align="center">Aletheia</h1>

<p align="center">Find the dark patterns on any website.</p>

<p align="center"><a href="https://aletheia.romitraj.dev">aletheia.romitraj.dev</a></p>

<a href="https://aletheia.romitraj.dev"><img src="docs/images/home.png" alt="The Aletheia home page: one box for the task, adobe.com picked from the words, and a sample report below" /></a>

Aletheia walks a site's checkout or sign-up flow like a customer, stops before payment and reports the dark patterns it saw. Each finding comes with its quote, its step and a screenshot.

## What it finds

- **Pricing:** drip pricing, partitioned pricing, bait and switch, a free claim with a charge, crossed-out prices.
- **Urgency and scarcity:** countdowns and deadlines, scarcity messages, high demand messages.
- **Crowd pressure:** activity messages about what other people are doing.
- **Sneaking and preselection:** items sneaked into the basket, pre-selected extras, longer plans pre-selected, hidden subscriptions.
- **Subscriptions and cancellation:** a card needed for a free trial, renewal in the small print, intro prices that jump, cancellation fees, sign-ups that are hard to cancel, missing cancellation terms.
- **Obstruction and forced action:** a price behind sign-in, forced actions, forced marketing consent.
- **Interface and wording:** false hierarchy, confirmshaming, trick questions, nagging, disguised ads.
- **Privacy and consent:** no cookie reject button, pre-ticked consent.

## How it works

![Four steps. Describe a flow. Agents walk the site, each in its own cloud browser. They stop before payment. Findings appear with their quote, step and screenshot.](docs/images/how-it-works.png)

## Built with

[TinyFish](https://tinyfish.ai), TypeScript, Hono, React and Bun.

## Setup

You need [Vite+](https://viteplus.dev), Node 26 and a TinyFish key in `.env` (see `.env.example`).

```
git clone https://github.com/brixdorf/aletheia.git
cd aletheia
vp install
vp run dev
```

## Licence

Open source under the [MIT licence](LICENSE).

## Team

Romit Raj Sahu ([brixdorf](https://github.com/brixdorf)) and Abhijit P ([adx19](https://github.com/adx19)).
