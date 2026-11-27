import type { CountrySites } from "../types.ts";

/** Sites from our own test runs come first in each category. */
export const IN_SITES: CountrySites = {
  location: `"Andheri West, Mumbai" (pincode 400058)`,
  categories: {
    food_delivery: [
      { name: "Zomato", url: "https://www.zomato.com/" },
      { name: "Swiggy", url: "https://www.swiggy.com/" },
    ],
    electronics: [
      { name: "Croma", url: "https://www.croma.com/" },
      { name: "Flipkart", url: "https://www.flipkart.com/" },
      { name: "Amazon", url: "https://www.amazon.in/" },
    ],
    fashion: [
      { name: "Myntra", url: "https://www.myntra.com/" },
      { name: "Flipkart", url: "https://www.flipkart.com/" },
    ],
    general: [
      { name: "Flipkart", url: "https://www.flipkart.com/" },
      { name: "Amazon", url: "https://www.amazon.in/" },
    ],
    travel: [
      { name: "ixigo", url: "https://www.ixigo.com/" },
      { name: "EaseMyTrip", url: "https://www.easemytrip.com/" },
      { name: "Cleartrip", url: "https://www.cleartrip.com/" },
    ],
    movies_events: [
      { name: "District", url: "https://www.district.in/" },
      { name: "BookMyShow", url: "https://in.bookmyshow.com/" },
    ],
    telecom: [
      { name: "Airtel", url: "https://www.airtel.in/" },
      { name: "Jio", url: "https://www.jio.com/" },
      { name: "Vi", url: "https://www.myvi.in/" },
    ],
    home: [
      { name: "Pepperfry", url: "https://www.pepperfry.com/" },
      { name: "IKEA", url: "https://www.ikea.com/in/" },
      { name: "Amazon", url: "https://www.amazon.in/" },
    ],
    streaming: [
      { name: "Netflix", url: "https://www.netflix.com/in/" },
      { name: "JioHotstar", url: "https://www.hotstar.com/in" },
      { name: "Amazon Prime", url: "https://www.amazon.in/amazonprime" },
    ],
    music: [
      { name: "Spotify", url: "https://www.spotify.com/in-en/premium/" },
      { name: "YouTube Premium", url: "https://www.youtube.com/premium" },
      { name: "Apple Music", url: "https://www.apple.com/in/apple-music/" },
    ],
  },
  brands: [
    { name: "Blinkit", url: "https://blinkit.com/", aliases: ["blinkit", "grofers"] },
    { name: "Zepto", url: "https://www.zepto.com/", aliases: ["zepto"] },
    { name: "BigBasket", url: "https://www.bigbasket.com/", aliases: ["bigbasket", "big basket"] },
    {
      name: "Swiggy Instamart",
      url: "https://www.swiggy.com/instamart",
      aliases: ["instamart", "swiggy instamart"],
    },
    { name: "Swiggy", url: "https://www.swiggy.com/", aliases: ["swiggy"] },
    { name: "Zomato", url: "https://www.zomato.com/", aliases: ["zomato"] },
    { name: "Flipkart", url: "https://www.flipkart.com/", aliases: ["flipkart"] },
    { name: "Myntra", url: "https://www.myntra.com/", aliases: ["myntra"] },
    { name: "Ajio", url: "https://www.ajio.com/", aliases: ["ajio"] },
    { name: "Nykaa", url: "https://www.nykaa.com/", aliases: ["nykaa"] },
    { name: "Meesho", url: "https://www.meesho.com/", aliases: ["meesho"] },
    {
      name: "Tata CLiQ",
      url: "https://www.tatacliq.com/",
      aliases: ["tata cliq", "tatacliq", "cliq"],
    },
    { name: "Croma", url: "https://www.croma.com/", aliases: ["croma"] },
    {
      name: "Reliance Digital",
      url: "https://www.reliancedigital.in/",
      aliases: ["reliance digital", "reliancedigital"],
    },
    {
      name: "MakeMyTrip",
      url: "https://www.makemytrip.com/",
      aliases: ["makemytrip", "make my trip", "mmt"],
    },
    { name: "Goibibo", url: "https://www.goibibo.com/", aliases: ["goibibo"] },
    { name: "Cleartrip", url: "https://www.cleartrip.com/", aliases: ["cleartrip"] },
    { name: "ixigo", url: "https://www.ixigo.com/", aliases: ["ixigo"] },
    {
      name: "EaseMyTrip",
      url: "https://www.easemytrip.com/",
      aliases: ["easemytrip", "ease my trip"],
    },
    { name: "IndiGo", url: "https://www.goindigo.in/", aliases: ["indigo", "6e"] },
    {
      name: "BookMyShow",
      url: "https://in.bookmyshow.com/",
      aliases: ["bookmyshow", "book my show", "bms"],
    },
    { name: "District", url: "https://www.district.in/", aliases: ["on district", "district app"] },
    { name: "Pepperfry", url: "https://www.pepperfry.com/", aliases: ["pepperfry"] },
    { name: "Bewakoof", url: "https://www.bewakoof.com/", aliases: ["bewakoof"] },
    {
      name: "Jio",
      url: "https://www.jio.com/",
      aliases: ["jio", "jiofiber", "jio fiber", "jio fibre"],
      subscription: true,
    },
    {
      name: "Vi",
      url: "https://www.myvi.in/",
      aliases: ["vodafone idea", "myvi"],
      subscription: true,
    },
    {
      name: "Airtel",
      url: "https://www.airtel.in/",
      aliases: ["airtel"],
      subscription: true,
    },
    {
      name: "JioHotstar",
      url: "https://www.hotstar.com/in",
      aliases: ["hotstar", "jiohotstar"],
      subscription: true,
    },
  ],
};
