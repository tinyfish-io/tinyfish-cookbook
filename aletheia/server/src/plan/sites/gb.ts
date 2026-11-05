import type { CountrySites } from "../types.ts";

export const GB_SITES: CountrySites = {
  location: `"Westminster, London" (postcode SW1A 1AA)`,
  categories: {
    food_delivery: [
      { name: "Deliveroo", url: "https://deliveroo.co.uk/" },
      { name: "Uber Eats", url: "https://www.ubereats.com/gb" },
      { name: "Just Eat", url: "https://www.just-eat.co.uk/" },
    ],
    electronics: [
      { name: "Currys", url: "https://www.currys.co.uk/" },
      { name: "Argos", url: "https://www.argos.co.uk/" },
      { name: "Amazon", url: "https://www.amazon.co.uk/" },
    ],
    fashion: [
      { name: "ASOS", url: "https://www.asos.com/" },
      { name: "Next", url: "https://www.next.co.uk/" },
      { name: "Marks & Spencer", url: "https://www.marksandspencer.com/" },
    ],
    general: [
      { name: "Amazon", url: "https://www.amazon.co.uk/" },
      { name: "Argos", url: "https://www.argos.co.uk/" },
      { name: "eBay", url: "https://www.ebay.co.uk/" },
    ],
    travel: [
      { name: "Booking.com", url: "https://www.booking.com/" },
      { name: "Expedia", url: "https://www.expedia.co.uk/" },
      { name: "lastminute.com", url: "https://www.lastminute.com/" },
    ],
    movies_events: [
      { name: "Ticketmaster", url: "https://www.ticketmaster.co.uk/" },
      { name: "Odeon", url: "https://www.odeon.co.uk/" },
      { name: "See Tickets", url: "https://www.seetickets.com/" },
    ],
    telecom: [
      { name: "BT", url: "https://www.bt.com/" },
      { name: "Sky", url: "https://www.sky.com/" },
      { name: "Virgin Media", url: "https://www.virginmedia.com/" },
    ],
    home: [
      { name: "IKEA", url: "https://www.ikea.com/gb/" },
      { name: "Dunelm", url: "https://www.dunelm.com/" },
      { name: "Wayfair", url: "https://www.wayfair.co.uk/" },
    ],
    fitness: [
      { name: "PureGym", url: "https://www.puregym.com/" },
      { name: "The Gym Group", url: "https://www.thegymgroup.com/" },
    ],
    news: [
      { name: "The Times", url: "https://www.thetimes.com/" },
      { name: "The Telegraph", url: "https://www.telegraph.co.uk/" },
    ],
  },
  brands: [
    { name: "Tesco", url: "https://www.tesco.com/", aliases: ["tesco"] },
    { name: "Sainsbury's", url: "https://www.sainsburys.co.uk/", aliases: ["sainsbury's"] },
    { name: "Ocado", url: "https://www.ocado.com/", aliases: ["ocado"] },
    { name: "Just Eat", url: "https://www.just-eat.co.uk/", aliases: ["just eat"] },
    { name: "Currys", url: "https://www.currys.co.uk/", aliases: ["currys"] },
    { name: "Argos", url: "https://www.argos.co.uk/", aliases: ["argos"] },
    {
      name: "Trainline",
      url: "https://www.thetrainline.com/",
      aliases: ["trainline", "train tickets", "train ticket", "train"],
    },
    { name: "EE", url: "https://ee.co.uk/", aliases: ["ee"], subscription: true },
    {
      name: "Vodafone",
      url: "https://www.vodafone.co.uk/",
      aliases: ["vodafone"],
      subscription: true,
    },
    { name: "O2", url: "https://www.o2.co.uk/", aliases: ["o2"], subscription: true },
    {
      name: "Three",
      url: "https://www.three.co.uk/",
      aliases: ["three mobile"],
      subscription: true,
    },
    {
      name: "Sky",
      url: "https://www.sky.com/",
      aliases: ["sky broadband", "sky tv"],
      subscription: true,
    },
    { name: "BT", url: "https://www.bt.com/", aliases: ["bt broadband"], subscription: true },
    { name: "Next", url: "https://www.next.co.uk/", aliases: ["on next", "at next"] },
    { name: "Boots", url: "https://www.boots.com/", aliases: ["on boots", "at boots"] },
    { name: "John Lewis", url: "https://www.johnlewis.com/", aliases: ["john lewis"] },
  ],
};
