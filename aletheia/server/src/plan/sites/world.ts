import type { Brand, CountrySites, Site } from "../types.ts";

const site = (name: string, url: string): Site => ({ name, url });

function brand(name: string, url: string, aliases: readonly string[], subscription = false): Brand {
  return { name, url, aliases, ...(subscription ? { subscription } : {}) };
}

const AMAZON_DE = site("Amazon", "https://www.amazon.de/");
const AMAZON_FR = site("Amazon", "https://www.amazon.fr/");
const AMAZON_JP = site("Amazon", "https://www.amazon.co.jp/");
const AMAZON_CA = site("Amazon", "https://www.amazon.ca/");
const AMAZON_AU = site("Amazon", "https://www.amazon.com.au/");
const AMAZON_BR = site("Amazon", "https://www.amazon.com.br/");
const AMAZON_MX = site("Amazon", "https://www.amazon.com.mx/");
const AMAZON_ES = site("Amazon", "https://www.amazon.es/");
const AMAZON_IT = site("Amazon", "https://www.amazon.it/");
const AMAZON_SA = site("Amazon", "https://www.amazon.sa/");
const AMAZON_AE = site("Amazon", "https://www.amazon.ae/");
const AMAZON_SG = site("Amazon", "https://www.amazon.sg/");
const BOOKING = site("Booking.com", "https://www.booking.com/");
const AGODA = site("Agoda", "https://www.agoda.com/");
const TRIP = site("Trip.com", "https://www.trip.com/");
const UBER_EATS = site("Uber Eats", "https://www.ubereats.com/");
const IKEA = site("IKEA", "https://www.ikea.com/");

export const CN_SITES: CountrySites = {
  location: `"Shanghai"`,
  categories: {
    food_delivery: [
      site("Meituan", "https://www.meituan.com/"),
      site("Ele.me", "https://www.ele.me/"),
    ],
    electronics: [site("JD.com", "https://www.jd.com/"), site("Tmall", "https://www.tmall.com/")],
    fashion: [site("Tmall", "https://www.tmall.com/"), site("Taobao", "https://www.taobao.com/")],
    general: [site("Taobao", "https://www.taobao.com/"), site("JD.com", "https://www.jd.com/")],
    travel: [site("Ctrip", "https://www.ctrip.com/"), site("Fliggy", "https://www.fliggy.com/")],
    movies_events: [
      site("Damai", "https://www.damai.cn/"),
      site("Maoyan", "https://www.maoyan.com/"),
    ],
    telecom: [
      site("China Mobile", "https://www.10086.cn/"),
      site("China Telecom", "https://www.189.cn/"),
      site("China Unicom", "https://www.10010.com/"),
    ],
    home: [site("JD.com", "https://www.jd.com/"), IKEA],
    streaming: [
      site("iQIYI", "https://www.iqiyi.com/"),
      site("Tencent Video", "https://v.qq.com/"),
    ],
    music: [
      site("QQ Music", "https://y.qq.com/"),
      site("NetEase Cloud Music", "https://music.163.com/"),
    ],
  },
  brands: [
    brand("Taobao", "https://www.taobao.com/", ["taobao"]),
    brand("Tmall", "https://www.tmall.com/", ["tmall"]),
    brand("JD.com", "https://www.jd.com/", ["jd.com", "jingdong"]),
    brand("Pinduoduo", "https://www.pinduoduo.com/", ["pinduoduo"]),
    brand("Ctrip", "https://www.ctrip.com/", ["ctrip"]),
    brand("Meituan", "https://www.meituan.com/", ["meituan"]),
  ],
};

export const KR_SITES: CountrySites = {
  location: `"Gangnam-gu, Seoul" (postal code 06236)`,
  categories: {
    food_delivery: [
      site("Baemin", "https://www.baemin.com/"),
      site("Coupang Eats", "https://www.coupangeats.com/"),
    ],
    electronics: [
      site("Coupang", "https://www.coupang.com/"),
      site("Danawa", "https://www.danawa.com/"),
      site("Himart", "https://www.e-himart.co.kr/"),
    ],
    fashion: [
      site("Musinsa", "https://www.musinsa.com/"),
      site("Coupang", "https://www.coupang.com/"),
    ],
    general: [
      site("Coupang", "https://www.coupang.com/"),
      site("Naver Shopping", "https://shopping.naver.com/"),
      site("Gmarket", "https://www.gmarket.co.kr/"),
    ],
    travel: [
      site("Yanolja", "https://www.yanolja.com/"),
      site("Hana Tour", "https://www.hanatour.com/"),
      AGODA,
    ],
    movies_events: [
      site("Interpark Ticket", "https://tickets.interpark.com/"),
      site("CGV", "https://www.cgv.co.kr/"),
      site("Melon Ticket", "https://ticket.melon.com/"),
    ],
    telecom: [
      site("SK Telecom", "https://www.tworld.co.kr/"),
      site("KT", "https://www.kt.com/"),
      site("LG U+", "https://www.lguplus.com/"),
    ],
    home: [site("Ohou", "https://ohou.se/"), IKEA],
    streaming: [
      site("Netflix", "https://www.netflix.com/"),
      site("TVING", "https://www.tving.com/"),
      site("Coupang Play", "https://www.coupangplay.com/"),
    ],
    music: [site("Melon", "https://www.melon.com/"), site("Genie", "https://www.genie.co.kr/")],
  },
  brands: [
    brand("Coupang", "https://www.coupang.com/", ["coupang"]),
    brand("Gmarket", "https://www.gmarket.co.kr/", ["gmarket"]),
    brand("Musinsa", "https://www.musinsa.com/", ["musinsa"]),
    brand("Baemin", "https://www.baemin.com/", ["baemin"]),
    brand("Interpark Ticket", "https://tickets.interpark.com/", ["interpark"]),
    brand("TVING", "https://www.tving.com/", ["tving"], true),
  ],
};

export const DE_SITES: CountrySites = {
  location: `"Berlin Mitte" (postcode 10115)`,
  categories: {
    food_delivery: [
      site("Lieferando", "https://www.lieferando.de/"),
      site("Wolt", "https://wolt.com/de/deu"),
      UBER_EATS,
    ],
    electronics: [
      site("MediaMarkt", "https://www.mediamarkt.de/"),
      AMAZON_DE,
      site("Otto", "https://www.otto.de/"),
    ],
    fashion: [
      site("Zalando", "https://www.zalando.de/"),
      site("About You", "https://www.aboutyou.de/"),
      site("Otto", "https://www.otto.de/"),
    ],
    general: [
      AMAZON_DE,
      site("Otto", "https://www.otto.de/"),
      site("Kaufland", "https://www.kaufland.de/"),
    ],
    travel: [
      site("Check24", "https://www.check24.de/"),
      site("Expedia", "https://www.expedia.de/"),
      BOOKING,
    ],
    movies_events: [
      site("Eventim", "https://www.eventim.de/"),
      site("Ticketmaster", "https://www.ticketmaster.de/"),
      site("CinemaxX", "https://www.cinemaxx.de/"),
    ],
    telecom: [
      site("Telekom", "https://www.telekom.de/"),
      site("Vodafone", "https://www.vodafone.de/"),
      site("O2", "https://www.o2online.de/"),
    ],
    home: [IKEA, site("Otto", "https://www.otto.de/"), site("Home24", "https://www.home24.de/")],
    fitness: [site("McFIT", "https://www.mcfit.com/"), site("FitX", "https://www.fitx.de/")],
    news: [site("Der Spiegel", "https://www.spiegel.de/"), site("Bild", "https://www.bild.de/")],
  },
  brands: [
    brand("Otto", "https://www.otto.de/", ["otto"]),
    brand("MediaMarkt", "https://www.mediamarkt.de/", ["mediamarkt", "media markt"]),
    brand("Saturn", "https://www.saturn.de/", ["saturn"]),
    brand("Lieferando", "https://www.lieferando.de/", ["lieferando"]),
    brand("Check24", "https://www.check24.de/", ["check24", "check 24"]),
    brand("Eventim", "https://www.eventim.de/", ["eventim"]),
    brand("Telekom", "https://www.telekom.de/", ["telekom"], true),
    brand("Vodafone", "https://www.vodafone.de/", ["vodafone"], true),
    brand("O2", "https://www.o2online.de/", ["o2"], true),
  ],
};

export const JP_SITES: CountrySites = {
  location: `"Shibuya, Tokyo" (postcode 150-0002)`,
  categories: {
    food_delivery: [
      site("Demae-can", "https://demae-can.com/"),
      UBER_EATS,
      site("Wolt", "https://wolt.com/ja"),
    ],
    electronics: [
      site("Yodobashi", "https://www.yodobashi.com/"),
      site("Bic Camera", "https://www.biccamera.com/"),
      AMAZON_JP,
    ],
    fashion: [site("ZOZOTOWN", "https://zozo.jp/"), site("Uniqlo", "https://www.uniqlo.com/jp/")],
    general: [
      AMAZON_JP,
      site("Rakuten", "https://www.rakuten.co.jp/"),
      site("Yahoo Shopping", "https://shopping.yahoo.co.jp/"),
    ],
    travel: [
      site("Rakuten Travel", "https://travel.rakuten.co.jp/"),
      site("Jalan", "https://www.jalan.net/"),
      BOOKING,
    ],
    movies_events: [
      site("Ticket Pia", "https://t.pia.jp/"),
      site("e+", "https://eplus.jp/"),
      site("Lawson Ticket", "https://l-tike.com/"),
    ],
    telecom: [
      site("NTT Docomo", "https://www.docomo.ne.jp/"),
      site("au", "https://www.au.com/"),
      site("SoftBank", "https://www.softbank.jp/"),
    ],
    home: [site("Nitori", "https://www.nitori-net.jp/"), IKEA],
  },
  brands: [
    brand("Rakuten", "https://www.rakuten.co.jp/", ["rakuten"]),
    brand("Yodobashi", "https://www.yodobashi.com/", ["yodobashi"]),
    brand("Mercari", "https://jp.mercari.com/", ["mercari"]),
    brand("ZOZOTOWN", "https://zozo.jp/", ["zozotown", "zozo"]),
    brand("NTT Docomo", "https://www.docomo.ne.jp/", ["docomo"], true),
    brand("SoftBank", "https://www.softbank.jp/", ["softbank"], true),
  ],
};

export const FR_SITES: CountrySites = {
  location: `"Paris" (postcode 75001)`,
  categories: {
    food_delivery: [
      UBER_EATS,
      site("Deliveroo", "https://deliveroo.fr/"),
      site("Just Eat", "https://www.just-eat.fr/"),
    ],
    electronics: [
      site("Fnac", "https://www.fnac.com/"),
      site("Darty", "https://www.darty.com/"),
      AMAZON_FR,
    ],
    fashion: [
      site("Zalando", "https://www.zalando.fr/"),
      site("La Redoute", "https://www.laredoute.fr/"),
      site("Vinted", "https://www.vinted.fr/"),
    ],
    general: [
      AMAZON_FR,
      site("Cdiscount", "https://www.cdiscount.com/"),
      site("Leroy Merlin", "https://www.leroymerlin.fr/"),
    ],
    travel: [
      site("SNCF Connect", "https://www.sncf-connect.com/"),
      BOOKING,
      site("Opodo", "https://www.opodo.fr/"),
    ],
    movies_events: [
      site("Fnac Spectacles", "https://www.fnacspectacles.com/"),
      site("Ticketmaster", "https://www.ticketmaster.fr/"),
      site("Pathe", "https://www.pathe.fr/"),
    ],
    telecom: [
      site("Orange", "https://www.orange.fr/"),
      site("SFR", "https://www.sfr.fr/"),
      site("Bouygues Telecom", "https://www.bouyguestelecom.fr/"),
    ],
    home: [
      IKEA,
      site("Conforama", "https://www.conforama.fr/"),
      site("Maisons du Monde", "https://www.maisonsdumonde.com/"),
    ],
    fitness: [site("Basic-Fit", "https://www.basic-fit.com/fr-fr/")],
    news: [
      site("Le Monde", "https://www.lemonde.fr/"),
      site("Le Figaro", "https://www.lefigaro.fr/"),
    ],
  },
  brands: [
    brand("Fnac", "https://www.fnac.com/", ["fnac"]),
    brand("Darty", "https://www.darty.com/", ["darty"]),
    brand("Cdiscount", "https://www.cdiscount.com/", ["cdiscount"]),
    brand("Vinted", "https://www.vinted.fr/", ["vinted"]),
    brand("Canal+", "https://www.canalplus.com/", ["canal plus", "canal+"], true),
    brand("Deezer", "https://www.deezer.com/", ["deezer"], true),
    brand("Orange", "https://www.orange.fr/", ["orange"], true),
    brand("SFR", "https://www.sfr.fr/", ["sfr"], true),
    brand("Free", "https://www.free.fr/", ["free mobile"], true),
  ],
};

export const ID_SITES: CountrySites = {
  location: `"Menteng, Jakarta Pusat" (postal code 10310)`,
  categories: {
    food_delivery: [
      site("GrabFood", "https://food.grab.com/id/"),
      site("GoFood", "https://gofood.co.id/"),
      site("ShopeeFood", "https://shopee.co.id/"),
    ],
    electronics: [
      site("Tokopedia", "https://www.tokopedia.com/"),
      site("Shopee", "https://shopee.co.id/"),
      site("Blibli", "https://www.blibli.com/"),
    ],
    fashion: [site("Shopee", "https://shopee.co.id/"), site("Zalora", "https://www.zalora.co.id/")],
    general: [
      site("Shopee", "https://shopee.co.id/"),
      site("Tokopedia", "https://www.tokopedia.com/"),
      site("Lazada", "https://www.lazada.co.id/"),
    ],
    travel: [
      site("Traveloka", "https://www.traveloka.com/"),
      site("tiket.com", "https://www.tiket.com/"),
      AGODA,
    ],
    movies_events: [
      site("TIX ID", "https://www.tix.id/"),
      site("Loket", "https://www.loket.com/"),
      site("tiket.com", "https://www.tiket.com/"),
    ],
    telecom: [
      site("Telkomsel", "https://www.telkomsel.com/"),
      site("Indosat", "https://ioh.co.id/"),
      site("XL", "https://www.xl.co.id/"),
    ],
    home: [
      site("IKEA", "https://www.ikea.co.id/"),
      site("Tokopedia", "https://www.tokopedia.com/"),
    ],
  },
  brands: [
    brand("Tokopedia", "https://www.tokopedia.com/", ["tokopedia", "tokped"]),
    brand("Traveloka", "https://www.traveloka.com/", ["traveloka"]),
    brand("tiket.com", "https://www.tiket.com/", ["tiket.com"]),
    brand("Gojek", "https://www.gojek.com/", ["gojek", "gofood"]),
    brand("Telkomsel", "https://www.telkomsel.com/", ["telkomsel"], true),
  ],
};

export const CA_SITES: CountrySites = {
  location: `"Toronto, ON" (postal code M5H 2N2)`,
  categories: {
    food_delivery: [
      UBER_EATS,
      site("DoorDash", "https://www.doordash.com/"),
      site("SkipTheDishes", "https://www.skipthedishes.com/"),
    ],
    electronics: [
      site("Best Buy", "https://www.bestbuy.ca/"),
      AMAZON_CA,
      site("Walmart", "https://www.walmart.ca/"),
    ],
    fashion: [
      site("Simons", "https://www.simons.ca/"),
      AMAZON_CA,
      site("Sport Chek", "https://www.sportchek.ca/"),
    ],
    general: [
      AMAZON_CA,
      site("Walmart", "https://www.walmart.ca/"),
      site("Canadian Tire", "https://www.canadiantire.ca/"),
    ],
    travel: [
      site("Expedia", "https://www.expedia.ca/"),
      BOOKING,
      site("Air Canada", "https://www.aircanada.com/"),
    ],
    movies_events: [
      site("Ticketmaster", "https://www.ticketmaster.ca/"),
      site("Cineplex", "https://www.cineplex.com/"),
    ],
    telecom: [
      site("Rogers", "https://www.rogers.com/"),
      site("Bell", "https://www.bell.ca/"),
      site("Telus", "https://www.telus.com/"),
    ],
    home: [
      IKEA,
      site("Wayfair", "https://www.wayfair.ca/"),
      site("The Brick", "https://www.thebrick.com/"),
    ],
    fitness: [site("GoodLife Fitness", "https://www.goodlifefitness.com/")],
  },
  brands: [
    brand("Walmart", "https://www.walmart.ca/", ["walmart"]),
    brand("Canadian Tire", "https://www.canadiantire.ca/", ["canadian tire"]),
    brand("Rogers", "https://www.rogers.com/", ["rogers"], true),
    brand("Bell", "https://www.bell.ca/", ["bell canada", "bell mobility"], true),
    brand("Telus", "https://www.telus.com/", ["telus"], true),
  ],
};

export const AU_SITES: CountrySites = {
  location: `"Sydney NSW" (postcode 2000)`,
  categories: {
    food_delivery: [
      UBER_EATS,
      site("DoorDash", "https://www.doordash.com/"),
      site("Menulog", "https://www.menulog.com.au/"),
    ],
    electronics: [
      site("JB Hi-Fi", "https://www.jbhifi.com.au/"),
      site("Harvey Norman", "https://www.harveynorman.com.au/"),
      AMAZON_AU,
    ],
    fashion: [
      site("The Iconic", "https://www.theiconic.com.au/"),
      site("Myer", "https://www.myer.com.au/"),
      site("David Jones", "https://www.davidjones.com/"),
    ],
    general: [
      AMAZON_AU,
      site("Kmart", "https://www.kmart.com.au/"),
      site("Catch", "https://www.catch.com.au/"),
    ],
    travel: [
      site("Webjet", "https://www.webjet.com.au/"),
      site("Wotif", "https://www.wotif.com/"),
      site("Expedia", "https://www.expedia.com.au/"),
    ],
    movies_events: [
      site("Ticketek", "https://premier.ticketek.com.au/"),
      site("Ticketmaster", "https://www.ticketmaster.com.au/"),
      site("Event Cinemas", "https://www.eventcinemas.com.au/"),
    ],
    telecom: [
      site("Telstra", "https://www.telstra.com.au/"),
      site("Optus", "https://www.optus.com.au/"),
      site("Vodafone", "https://www.vodafone.com.au/"),
    ],
    home: [
      IKEA,
      site("Bunnings", "https://www.bunnings.com.au/"),
      site("Temple & Webster", "https://www.templeandwebster.com.au/"),
    ],
    fitness: [site("Anytime Fitness", "https://www.anytimefitness.com.au/")],
  },
  brands: [
    brand("JB Hi-Fi", "https://www.jbhifi.com.au/", ["jb hi-fi", "jb hifi", "jbhifi"]),
    brand("Kmart", "https://www.kmart.com.au/", ["kmart"]),
    brand("Bunnings", "https://www.bunnings.com.au/", ["bunnings"]),
    brand("Telstra", "https://www.telstra.com.au/", ["telstra"], true),
    brand("Optus", "https://www.optus.com.au/", ["optus"], true),
    brand("Stan", "https://www.stan.com.au/", ["stan streaming"], true),
  ],
};

export const BR_SITES: CountrySites = {
  location: `"Bela Vista, Sao Paulo" (CEP 01310-100)`,
  categories: {
    food_delivery: [
      site("iFood", "https://www.ifood.com.br/"),
      site("99Food", "https://99app.com/"),
    ],
    electronics: [
      site("Mercado Livre", "https://www.mercadolivre.com.br/"),
      site("Magazine Luiza", "https://www.magazineluiza.com.br/"),
      site("KaBuM", "https://www.kabum.com.br/"),
    ],
    fashion: [
      site("Dafiti", "https://www.dafiti.com.br/"),
      site("Renner", "https://www.lojasrenner.com.br/"),
      site("Shopee", "https://shopee.com.br/"),
    ],
    general: [
      site("Mercado Livre", "https://www.mercadolivre.com.br/"),
      site("Shopee", "https://shopee.com.br/"),
      AMAZON_BR,
    ],
    travel: [
      site("Decolar", "https://www.decolar.com/"),
      site("123milhas", "https://123milhas.com/"),
      site("CVC", "https://www.cvc.com.br/"),
    ],
    movies_events: [
      site("Ingresso.com", "https://www.ingresso.com/"),
      site("Sympla", "https://www.sympla.com.br/"),
      site("Eventim", "https://www.eventim.com.br/"),
    ],
    telecom: [
      site("Vivo", "https://www.vivo.com.br/"),
      site("Claro", "https://www.claro.com.br/"),
      site("TIM", "https://www.tim.com.br/"),
    ],
    home: [
      site("Mobly", "https://www.mobly.com.br/"),
      site("Tok&Stok", "https://www.tokstok.com.br/"),
      site("Magazine Luiza", "https://www.magazineluiza.com.br/"),
    ],
  },
  brands: [
    brand("iFood", "https://www.ifood.com.br/", ["ifood"]),
    brand("Magazine Luiza", "https://www.magazineluiza.com.br/", ["magazine luiza", "magalu"]),
    brand("Americanas", "https://www.americanas.com.br/", ["americanas"]),
    brand("Decolar", "https://www.decolar.com/", ["decolar"]),
    brand("Globoplay", "https://globoplay.globo.com/", ["globoplay"], true),
    brand("Vivo", "https://www.vivo.com.br/", ["vivo"], true),
  ],
};

export const MX_SITES: CountrySites = {
  location: `"Cuauhtemoc, Ciudad de Mexico" (CP 06000)`,
  categories: {
    food_delivery: [
      site("Rappi", "https://www.rappi.com.mx/"),
      UBER_EATS,
      site("DiDi Food", "https://www.didi-food.com/es-MX/"),
    ],
    electronics: [
      site("Mercado Libre", "https://www.mercadolibre.com.mx/"),
      AMAZON_MX,
      site("Liverpool", "https://www.liverpool.com.mx/"),
    ],
    fashion: [
      site("Liverpool", "https://www.liverpool.com.mx/"),
      site("Coppel", "https://www.coppel.com/"),
      site("Shein", "https://www.shein.com.mx/"),
    ],
    general: [
      site("Mercado Libre", "https://www.mercadolibre.com.mx/"),
      AMAZON_MX,
      site("Walmart", "https://www.walmart.com.mx/"),
    ],
    travel: [
      site("Despegar", "https://www.despegar.com.mx/"),
      site("Volaris", "https://www.volaris.com/"),
      site("Viva Aerobus", "https://www.vivaaerobus.com/"),
    ],
    movies_events: [
      site("Ticketmaster", "https://www.ticketmaster.com.mx/"),
      site("Cinepolis", "https://cinepolis.com/"),
      site("Cinemex", "https://cinemex.com/"),
    ],
    telecom: [
      site("Telcel", "https://www.telcel.com/"),
      site("AT&T", "https://www.att.com.mx/"),
      site("Movistar", "https://www.movistar.com.mx/"),
    ],
    home: [
      IKEA,
      site("Liverpool", "https://www.liverpool.com.mx/"),
      site("Coppel", "https://www.coppel.com/"),
    ],
  },
  brands: [
    brand("Liverpool", "https://www.liverpool.com.mx/", ["liverpool mexico", "tienda liverpool"]),
    brand("Coppel", "https://www.coppel.com/", ["coppel"]),
    brand("Rappi", "https://www.rappi.com.mx/", ["rappi"]),
    brand("Despegar", "https://www.despegar.com.mx/", ["despegar"]),
    brand("Telcel", "https://www.telcel.com/", ["telcel"], true),
  ],
};

export const TH_SITES: CountrySites = {
  location: `"Pathum Wan, Bangkok" (postal code 10330)`,
  categories: {
    food_delivery: [
      site("GrabFood", "https://food.grab.com/th/"),
      site("LINE MAN", "https://lineman.line.me/"),
      site("foodpanda", "https://www.foodpanda.co.th/"),
    ],
    electronics: [
      site("Power Buy", "https://www.powerbuy.co.th/"),
      site("Shopee", "https://shopee.co.th/"),
      site("Lazada", "https://www.lazada.co.th/"),
    ],
    fashion: [site("Shopee", "https://shopee.co.th/"), site("Lazada", "https://www.lazada.co.th/")],
    general: [
      site("Shopee", "https://shopee.co.th/"),
      site("Lazada", "https://www.lazada.co.th/"),
      site("Central", "https://www.central.co.th/"),
    ],
    travel: [AGODA, site("Traveloka", "https://www.traveloka.com/th-th/"), TRIP],
    movies_events: [
      site("Thai Ticket Major", "https://www.thaiticketmajor.com/"),
      site("Major Cineplex", "https://www.majorcineplex.com/"),
    ],
    telecom: [
      site("AIS", "https://www.ais.th/"),
      site("True", "https://www.true.th/"),
      site("NT", "https://www.ntplc.co.th/"),
    ],
    home: [
      site("IKEA", "https://www.ikea.com/th/"),
      site("Index Living Mall", "https://www.indexlivingmall.com/"),
    ],
  },
  brands: [
    brand("Power Buy", "https://www.powerbuy.co.th/", ["power buy", "powerbuy"]),
    brand("AIS", "https://www.ais.th/", ["ais"], true),
    brand("True", "https://www.true.th/", ["true move", "truemove"], true),
  ],
};

export const VN_SITES: CountrySites = {
  location: `"Quan 1, Ho Chi Minh City"`,
  categories: {
    food_delivery: [
      site("GrabFood", "https://food.grab.com/vn/"),
      site("ShopeeFood", "https://shopeefood.vn/"),
      site("Be", "https://be.com.vn/"),
    ],
    electronics: [
      site("The Gioi Di Dong", "https://www.thegioididong.com/"),
      site("FPT Shop", "https://fptshop.com.vn/"),
      site("Dien May Xanh", "https://www.dienmayxanh.com/"),
    ],
    fashion: [site("Shopee", "https://shopee.vn/"), site("Lazada", "https://www.lazada.vn/")],
    general: [
      site("Shopee", "https://shopee.vn/"),
      site("Lazada", "https://www.lazada.vn/"),
      site("Tiki", "https://tiki.vn/"),
    ],
    travel: [
      site("Traveloka", "https://www.traveloka.com/vi-vn/"),
      site("Vietnam Airlines", "https://www.vietnamairlines.com/"),
      AGODA,
    ],
    movies_events: [site("CGV", "https://www.cgv.vn/"), site("Ticketbox", "https://ticketbox.vn/")],
    telecom: [
      site("Viettel", "https://vietteltelecom.vn/"),
      site("VinaPhone", "https://vinaphone.com.vn/"),
      site("MobiFone", "https://www.mobifone.vn/"),
    ],
    home: [site("Noithat", "https://www.dienmayxanh.com/"), site("Shopee", "https://shopee.vn/")],
  },
  brands: [
    brand("Tiki", "https://tiki.vn/", ["tiki"]),
    brand("The Gioi Di Dong", "https://www.thegioididong.com/", [
      "thegioididong",
      "the gioi di dong",
    ]),
    brand("Viettel", "https://vietteltelecom.vn/", ["viettel"], true),
  ],
};

export const ES_SITES: CountrySites = {
  location: `"Madrid" (postcode 28013)`,
  categories: {
    food_delivery: [
      site("Glovo", "https://glovoapp.com/es/"),
      site("Just Eat", "https://www.just-eat.es/"),
      UBER_EATS,
    ],
    electronics: [
      site("El Corte Ingles", "https://www.elcorteingles.es/"),
      site("PcComponentes", "https://www.pccomponentes.com/"),
      site("MediaMarkt", "https://www.mediamarkt.es/"),
    ],
    fashion: [
      site("Zara", "https://www.zara.com/es/"),
      site("Zalando", "https://www.zalando.es/"),
      site("El Corte Ingles", "https://www.elcorteingles.es/"),
    ],
    general: [
      AMAZON_ES,
      site("El Corte Ingles", "https://www.elcorteingles.es/"),
      site("Carrefour", "https://www.carrefour.es/"),
    ],
    travel: [
      site("eDreams", "https://www.edreams.es/"),
      BOOKING,
      site("Renfe", "https://www.renfe.com/"),
    ],
    movies_events: [
      site("Ticketmaster", "https://www.ticketmaster.es/"),
      site("Entradas.com", "https://www.entradas.com/"),
      site("Cinesa", "https://www.cinesa.es/"),
    ],
    telecom: [
      site("Movistar", "https://www.movistar.es/"),
      site("Vodafone", "https://www.vodafone.es/"),
      site("Orange", "https://www.orange.es/"),
    ],
    home: [IKEA, site("Leroy Merlin", "https://www.leroymerlin.es/")],
  },
  brands: [
    brand("El Corte Ingles", "https://www.elcorteingles.es/", ["el corte ingles", "corte ingles"]),
    brand("PcComponentes", "https://www.pccomponentes.com/", ["pccomponentes"]),
    brand("Glovo", "https://glovoapp.com/es/", ["glovo"]),
    brand("Renfe", "https://www.renfe.com/", ["renfe"]),
    brand("Movistar", "https://www.movistar.es/", ["movistar"], true),
  ],
};

export const IT_SITES: CountrySites = {
  location: `"Milano" (postcode 20121)`,
  categories: {
    food_delivery: [
      site("Glovo", "https://glovoapp.com/it/"),
      site("Deliveroo", "https://deliveroo.it/"),
      site("Just Eat", "https://www.justeat.it/"),
    ],
    electronics: [
      site("MediaWorld", "https://www.mediaworld.it/"),
      site("Unieuro", "https://www.unieuro.it/"),
      AMAZON_IT,
    ],
    fashion: [
      site("Zalando", "https://www.zalando.it/"),
      site("Yoox", "https://www.yoox.com/it/"),
      site("OVS", "https://www.ovs.it/"),
    ],
    general: [
      AMAZON_IT,
      site("ePRICE", "https://www.eprice.it/"),
      site("Temu", "https://www.temu.com/it/"),
    ],
    travel: [
      site("Trenitalia", "https://www.trenitalia.com/"),
      site("eDreams", "https://www.edreams.it/"),
      BOOKING,
    ],
    movies_events: [
      site("TicketOne", "https://www.ticketone.it/"),
      site("Vivaticket", "https://www.vivaticket.com/it"),
      site("The Space Cinema", "https://www.thespacecinema.it/"),
    ],
    telecom: [
      site("TIM", "https://www.tim.it/"),
      site("Vodafone", "https://www.vodafone.it/"),
      site("WindTre", "https://www.windtre.it/"),
    ],
    home: [IKEA, site("Leroy Merlin", "https://www.leroymerlin.it/")],
  },
  brands: [
    brand("MediaWorld", "https://www.mediaworld.it/", ["mediaworld"]),
    brand("Unieuro", "https://www.unieuro.it/", ["unieuro"]),
    brand("TicketOne", "https://www.ticketone.it/", ["ticketone"]),
    brand("Trenitalia", "https://www.trenitalia.com/", ["trenitalia"]),
    brand("TIM", "https://www.tim.it/", ["tim"], true),
  ],
};

export const NL_SITES: CountrySites = {
  location: `"Amsterdam" (postcode 1012)`,
  categories: {
    food_delivery: [site("Thuisbezorgd", "https://www.thuisbezorgd.nl/"), UBER_EATS],
    electronics: [
      site("Coolblue", "https://www.coolblue.nl/"),
      site("bol", "https://www.bol.com/"),
      site("MediaMarkt", "https://www.mediamarkt.nl/"),
    ],
    fashion: [
      site("Zalando", "https://www.zalando.nl/"),
      site("Wehkamp", "https://www.wehkamp.nl/"),
      site("bol", "https://www.bol.com/"),
    ],
    general: [
      site("bol", "https://www.bol.com/"),
      site("Amazon", "https://www.amazon.nl/"),
      site("Coolblue", "https://www.coolblue.nl/"),
    ],
    travel: [
      BOOKING,
      site("Expedia", "https://www.expedia.nl/"),
      site("KLM", "https://www.klm.nl/"),
    ],
    movies_events: [
      site("Ticketmaster", "https://www.ticketmaster.nl/"),
      site("Pathe", "https://www.pathe.nl/"),
    ],
    telecom: [
      site("KPN", "https://www.kpn.com/"),
      site("Odido", "https://www.odido.nl/"),
      site("Vodafone", "https://www.vodafone.nl/"),
    ],
    home: [IKEA, site("Wehkamp", "https://www.wehkamp.nl/")],
  },
  brands: [
    brand("bol", "https://www.bol.com/", ["bol.com", "bol com"]),
    brand("Coolblue", "https://www.coolblue.nl/", ["coolblue"]),
    brand("Thuisbezorgd", "https://www.thuisbezorgd.nl/", ["thuisbezorgd"]),
    brand("KPN", "https://www.kpn.com/", ["kpn"], true),
    brand("Odido", "https://www.odido.nl/", ["odido"], true),
  ],
};

export const TR_SITES: CountrySites = {
  location: `"Kadikoy, Istanbul" (postal code 34710)`,
  categories: {
    food_delivery: [
      site("Yemeksepeti", "https://www.yemeksepeti.com/"),
      site("Getir", "https://getir.com/"),
      site("Trendyol Yemek", "https://www.trendyol.com/"),
    ],
    electronics: [
      site("Hepsiburada", "https://www.hepsiburada.com/"),
      site("Trendyol", "https://www.trendyol.com/"),
      site("Teknosa", "https://www.teknosa.com/"),
    ],
    fashion: [
      site("Trendyol", "https://www.trendyol.com/"),
      site("Boyner", "https://www.boyner.com.tr/"),
      site("LC Waikiki", "https://www.lcwaikiki.com/"),
    ],
    general: [
      site("Trendyol", "https://www.trendyol.com/"),
      site("Hepsiburada", "https://www.hepsiburada.com/"),
      site("n11", "https://www.n11.com/"),
    ],
    travel: [
      site("Enuygun", "https://www.enuygun.com/"),
      site("Turkish Airlines", "https://www.turkishairlines.com/"),
      site("Pegasus", "https://www.flypgs.com/"),
    ],
    movies_events: [
      site("Biletix", "https://www.biletix.com/"),
      site("Passo", "https://www.passo.com.tr/"),
    ],
    telecom: [
      site("Turkcell", "https://www.turkcell.com.tr/"),
      site("Vodafone", "https://www.vodafone.com.tr/"),
      site("Turk Telekom", "https://www.turktelekom.com.tr/"),
    ],
    home: [IKEA, site("Trendyol", "https://www.trendyol.com/")],
  },
  brands: [
    brand("Trendyol", "https://www.trendyol.com/", ["trendyol"]),
    brand("Hepsiburada", "https://www.hepsiburada.com/", ["hepsiburada"]),
    brand("Yemeksepeti", "https://www.yemeksepeti.com/", ["yemeksepeti"]),
    brand("Turkcell", "https://www.turkcell.com.tr/", ["turkcell"], true),
  ],
};

export const SA_SITES: CountrySites = {
  location: `"Olaya, Riyadh" (postal code 12211)`,
  categories: {
    food_delivery: [
      site("HungerStation", "https://hungerstation.com/"),
      site("Jahez", "https://www.jahez.net/"),
      site("Talabat", "https://www.talabat.com/"),
    ],
    electronics: [
      site("Jarir", "https://www.jarir.com/"),
      site("eXtra", "https://www.extra.com/"),
      site("noon", "https://www.noon.com/saudi-en/"),
    ],
    fashion: [
      site("Namshi", "https://www.namshi.com/"),
      site("noon", "https://www.noon.com/saudi-en/"),
    ],
    general: [site("noon", "https://www.noon.com/saudi-en/"), AMAZON_SA],
    travel: [
      site("Almosafer", "https://www.almosafer.com/"),
      site("Saudia", "https://www.saudia.com/"),
      site("flynas", "https://www.flynas.com/"),
    ],
    movies_events: [
      site("Webook", "https://webook.com/"),
      site("Platinumlist", "https://www.platinumlist.net/"),
    ],
    telecom: [
      site("stc", "https://www.stc.com.sa/"),
      site("Mobily", "https://www.mobily.com.sa/"),
      site("Zain", "https://www.sa.zain.com/"),
    ],
    home: [
      site("IKEA", "https://www.ikea.com/sa/"),
      site("noon", "https://www.noon.com/saudi-en/"),
    ],
  },
  brands: [
    brand("noon", "https://www.noon.com/saudi-en/", ["noon.com", "noon"]),
    brand("Jarir", "https://www.jarir.com/", ["jarir"]),
    brand("HungerStation", "https://hungerstation.com/", ["hungerstation"]),
    brand("stc", "https://www.stc.com.sa/", ["stc"], true),
  ],
};

export const AE_SITES: CountrySites = {
  location: `"Downtown Dubai"`,
  categories: {
    food_delivery: [
      site("Talabat", "https://www.talabat.com/"),
      site("Deliveroo", "https://deliveroo.ae/"),
      site("Noon Food", "https://www.noon.com/uae-en/"),
    ],
    electronics: [
      site("Sharaf DG", "https://uae.sharafdg.com/"),
      AMAZON_AE,
      site("noon", "https://www.noon.com/uae-en/"),
    ],
    fashion: [
      site("Namshi", "https://www.namshi.com/"),
      site("noon", "https://www.noon.com/uae-en/"),
    ],
    general: [site("noon", "https://www.noon.com/uae-en/"), AMAZON_AE],
    travel: [
      site("Emirates", "https://www.emirates.com/"),
      site("flydubai", "https://www.flydubai.com/"),
      site("Almosafer", "https://www.almosafer.com/"),
    ],
    movies_events: [
      site("Platinumlist", "https://www.platinumlist.net/"),
      site("VOX Cinemas", "https://uae.voxcinemas.com/"),
    ],
    telecom: [site("e&", "https://www.etisalat.ae/"), site("du", "https://www.du.ae/")],
    home: [
      site("IKEA", "https://www.ikea.com/ae/"),
      site("Home Centre", "https://www.homecentre.com/ae/"),
    ],
  },
  brands: [
    brand("noon", "https://www.noon.com/uae-en/", ["noon.com", "noon"]),
    brand("Talabat", "https://www.talabat.com/", ["talabat"]),
    brand("Careem", "https://www.careem.com/", ["careem"]),
    brand("Namshi", "https://www.namshi.com/", ["namshi"]),
    brand("Etisalat", "https://www.etisalat.ae/", ["etisalat"], true),
  ],
};

export const PH_SITES: CountrySites = {
  location: `"Makati, Metro Manila" (postal code 1200)`,
  categories: {
    food_delivery: [
      site("GrabFood", "https://food.grab.com/ph/"),
      site("foodpanda", "https://www.foodpanda.ph/"),
    ],
    electronics: [
      site("Shopee", "https://shopee.ph/"),
      site("Lazada", "https://www.lazada.com.ph/"),
    ],
    fashion: [site("Zalora", "https://www.zalora.com.ph/"), site("Shopee", "https://shopee.ph/")],
    general: [site("Shopee", "https://shopee.ph/"), site("Lazada", "https://www.lazada.com.ph/")],
    travel: [
      site("Cebu Pacific", "https://www.cebupacificair.com/"),
      site("Philippine Airlines", "https://www.philippineairlines.com/"),
      AGODA,
    ],
    movies_events: [
      site("TicketNet", "https://www.ticketnet.com.ph/"),
      site("SM Tickets", "https://smtickets.com/"),
    ],
    telecom: [
      site("Globe", "https://www.globe.com.ph/"),
      site("Smart", "https://smart.com.ph/"),
      site("DITO", "https://dito.ph/"),
    ],
    home: [site("IKEA", "https://www.ikea.com/ph/"), site("Lazada", "https://www.lazada.com.ph/")],
  },
  brands: [
    brand("Globe", "https://www.globe.com.ph/", ["globe"], true),
    brand("Smart", "https://smart.com.ph/", ["smart postpaid", "smart prepaid"], true),
    brand("Cebu Pacific", "https://www.cebupacificair.com/", ["cebu pacific", "cebupac"]),
  ],
};

export const MY_SITES: CountrySites = {
  location: `"Bukit Bintang, Kuala Lumpur" (postcode 50200)`,
  categories: {
    food_delivery: [
      site("GrabFood", "https://food.grab.com/my/"),
      site("foodpanda", "https://www.foodpanda.my/"),
      site("ShopeeFood", "https://shopee.com.my/"),
    ],
    electronics: [
      site("Shopee", "https://shopee.com.my/"),
      site("Lazada", "https://www.lazada.com.my/"),
      site("Harvey Norman", "https://www.harveynorman.com.my/"),
    ],
    fashion: [
      site("Zalora", "https://www.zalora.com.my/"),
      site("Shopee", "https://shopee.com.my/"),
    ],
    general: [
      site("Shopee", "https://shopee.com.my/"),
      site("Lazada", "https://www.lazada.com.my/"),
    ],
    travel: [
      site("AirAsia", "https://www.airasia.com/"),
      site("Malaysia Airlines", "https://www.malaysiaairlines.com/"),
      AGODA,
    ],
    movies_events: [
      site("TGV Cinemas", "https://www.tgv.com.my/"),
      site("GSC", "https://www.gsc.com.my/"),
    ],
    telecom: [
      site("Maxis", "https://www.maxis.com.my/"),
      site("CelcomDigi", "https://www.celcomdigi.com/"),
      site("U Mobile", "https://www.u.com.my/"),
    ],
    home: [site("IKEA", "https://www.ikea.com/my/"), site("Lazada", "https://www.lazada.com.my/")],
  },
  brands: [
    brand("AirAsia", "https://www.airasia.com/", ["airasia", "air asia"]),
    brand("Maxis", "https://www.maxis.com.my/", ["maxis"], true),
    brand("Astro", "https://www.astro.com.my/", ["astro"], true),
  ],
};

export const SG_SITES: CountrySites = {
  location: `"Orchard Road, Singapore" (postal code 238801)`,
  categories: {
    food_delivery: [
      site("GrabFood", "https://food.grab.com/sg/en/"),
      site("foodpanda", "https://www.foodpanda.sg/"),
      site("Deliveroo", "https://deliveroo.com.sg/"),
    ],
    electronics: [
      site("Courts", "https://www.courts.com.sg/"),
      site("Challenger", "https://www.challenger.sg/"),
      site("Harvey Norman", "https://www.harveynorman.com.sg/"),
    ],
    fashion: [site("Zalora", "https://www.zalora.sg/"), site("Shopee", "https://shopee.sg/")],
    general: [
      site("Shopee", "https://shopee.sg/"),
      site("Lazada", "https://www.lazada.sg/"),
      AMAZON_SG,
    ],
    travel: [
      site("Singapore Airlines", "https://www.singaporeair.com/"),
      site("Scoot", "https://www.flyscoot.com/"),
      AGODA,
    ],
    movies_events: [
      site("SISTIC", "https://www.sistic.com.sg/"),
      site("Golden Village", "https://www.gv.com.sg/"),
    ],
    telecom: [
      site("Singtel", "https://www.singtel.com/"),
      site("StarHub", "https://www.starhub.com/"),
      site("M1", "https://www.m1.com.sg/"),
    ],
    home: [site("IKEA", "https://www.ikea.com/sg/"), site("Courts", "https://www.courts.com.sg/")],
  },
  brands: [
    brand("Grab", "https://www.grab.com/sg/", ["grab food", "grabfood", "grab"]),
    brand("foodpanda", "https://www.foodpanda.sg/", ["foodpanda", "food panda"]),
    brand("Singtel", "https://www.singtel.com/", ["singtel"], true),
  ],
};

export const PL_SITES: CountrySites = {
  location: `"Warszawa" (postcode 00-001)`,
  categories: {
    food_delivery: [
      site("Pyszne.pl", "https://www.pyszne.pl/"),
      site("Glovo", "https://glovoapp.com/pl/"),
      UBER_EATS,
    ],
    electronics: [
      site("RTV Euro AGD", "https://www.euro.com.pl/"),
      site("Media Expert", "https://www.mediaexpert.pl/"),
      site("x-kom", "https://www.x-kom.pl/"),
    ],
    fashion: [site("Zalando", "https://www.zalando.pl/"), site("Allegro", "https://allegro.pl/")],
    general: [
      site("Allegro", "https://allegro.pl/"),
      site("Amazon", "https://www.amazon.pl/"),
      site("Temu", "https://www.temu.com/pl/"),
    ],
    travel: [site("eSky", "https://www.esky.pl/"), site("LOT", "https://www.lot.com/"), BOOKING],
    movies_events: [
      site("eBilet", "https://www.ebilet.pl/"),
      site("Eventim", "https://www.eventim.pl/"),
      site("Cinema City", "https://www.cinema-city.pl/"),
    ],
    telecom: [
      site("Orange", "https://www.orange.pl/"),
      site("Play", "https://www.play.pl/"),
      site("Plus", "https://www.plus.pl/"),
    ],
    home: [IKEA, site("Allegro", "https://allegro.pl/")],
  },
  brands: [
    brand("Allegro", "https://allegro.pl/", ["allegro"]),
    brand("x-kom", "https://www.x-kom.pl/", ["x-kom", "xkom"]),
    brand("Pyszne.pl", "https://www.pyszne.pl/", ["pyszne"]),
  ],
};

export const WORLD_MARKETS: Readonly<Record<string, CountrySites>> = {
  CN: CN_SITES,
  KR: KR_SITES,
  DE: DE_SITES,
  JP: JP_SITES,
  FR: FR_SITES,
  ID: ID_SITES,
  CA: CA_SITES,
  AU: AU_SITES,
  BR: BR_SITES,
  MX: MX_SITES,
  TH: TH_SITES,
  VN: VN_SITES,
  ES: ES_SITES,
  IT: IT_SITES,
  NL: NL_SITES,
  TR: TR_SITES,
  SA: SA_SITES,
  AE: AE_SITES,
  PH: PH_SITES,
  MY: MY_SITES,
  SG: SG_SITES,
  PL: PL_SITES,
};
