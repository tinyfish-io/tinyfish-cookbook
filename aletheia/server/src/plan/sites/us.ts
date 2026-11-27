import type { CountrySites } from "../types.ts";

export const US_SITES: CountrySites = {
  location: `"New York, NY" (ZIP code 10001)`,
  categories: {
    food_delivery: [
      { name: "DoorDash", url: "https://www.doordash.com/" },
      { name: "Uber Eats", url: "https://www.ubereats.com/" },
      { name: "Grubhub", url: "https://www.grubhub.com/" },
    ],
    electronics: [
      { name: "Best Buy", url: "https://www.bestbuy.com/" },
      { name: "Amazon", url: "https://www.amazon.com/" },
      { name: "Walmart", url: "https://www.walmart.com/" },
    ],
    fashion: [
      { name: "Nordstrom", url: "https://www.nordstrom.com/" },
      { name: "Macy's", url: "https://www.macys.com/" },
      { name: "Amazon", url: "https://www.amazon.com/" },
    ],
    general: [
      { name: "Amazon", url: "https://www.amazon.com/" },
      { name: "Walmart", url: "https://www.walmart.com/" },
      { name: "Target", url: "https://www.target.com/" },
    ],
    travel: [
      { name: "Expedia", url: "https://www.expedia.com/" },
      { name: "Booking.com", url: "https://www.booking.com/" },
      { name: "Priceline", url: "https://www.priceline.com/" },
    ],
    movies_events: [
      { name: "Ticketmaster", url: "https://www.ticketmaster.com/" },
      { name: "Fandango", url: "https://www.fandango.com/" },
      { name: "StubHub", url: "https://www.stubhub.com/" },
    ],
    telecom: [
      { name: "Verizon", url: "https://www.verizon.com/" },
      { name: "T-Mobile", url: "https://www.t-mobile.com/" },
      { name: "AT&T", url: "https://www.att.com/" },
    ],
    home: [
      { name: "IKEA", url: "https://www.ikea.com/us/" },
      { name: "Wayfair", url: "https://www.wayfair.com/" },
      { name: "Home Depot", url: "https://www.homedepot.com/" },
    ],
    streaming: [
      { name: "Netflix", url: "https://www.netflix.com/" },
      { name: "Hulu", url: "https://www.hulu.com/" },
      { name: "Disney+", url: "https://www.disneyplus.com/" },
    ],
    fitness: [
      { name: "Planet Fitness", url: "https://www.planetfitness.com/" },
      { name: "Peloton", url: "https://www.onepeloton.com/" },
    ],
    news: [
      { name: "The New York Times", url: "https://www.nytimes.com/subscription" },
      { name: "The Wall Street Journal", url: "https://www.wsj.com/" },
    ],
  },
  brands: [
    { name: "Instacart", url: "https://www.instacart.com/", aliases: ["instacart"] },
    { name: "Verizon", url: "https://www.verizon.com/", aliases: ["verizon"], subscription: true },
    {
      name: "T-Mobile",
      url: "https://www.t-mobile.com/",
      aliases: ["t-mobile", "tmobile", "t mobile"],
      subscription: true,
    },
    { name: "AT&T", url: "https://www.att.com/", aliases: ["at&t", "att"], subscription: true },
    {
      name: "Planet Fitness",
      url: "https://www.planetfitness.com/",
      aliases: ["planet fitness"],
      subscription: true,
    },
    { name: "Sweetwater", url: "https://www.sweetwater.com/", aliases: ["sweetwater"] },
    { name: "Walmart", url: "https://www.walmart.com/", aliases: ["walmart"] },
    { name: "Target", url: "https://www.target.com/", aliases: ["on target", "at target"] },
    { name: "Grubhub", url: "https://www.grubhub.com/", aliases: ["grubhub"] },
    { name: "Nordstrom", url: "https://www.nordstrom.com/", aliases: ["nordstrom"] },
    { name: "Macy's", url: "https://www.macys.com/", aliases: ["macy's", "macys"] },
  ],
};
