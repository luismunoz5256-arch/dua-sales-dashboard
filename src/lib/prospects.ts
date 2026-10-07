import type { Client, ProductLine } from './types'
import { miles, type Point } from './route'

/** A business from Google Places, trimmed to what the app uses. */
export interface Place {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  primaryType: string | null
  typeLabel: string | null
  types: string[]
  rating: number | null
  reviews: number | null
  priceLevel: number | null
  phone: string | null
  website: string | null
  mapsUrl: string | null
  openNow: boolean | null
  status: string | null
  servesBrunch: boolean | null
  servesBreakfast: boolean | null
  servesVegetarian: boolean | null
  servesCocktails: boolean | null
  summary: string | null
}

export type Category =
  | 'restaurant' | 'taqueria' | 'bar' | 'cafe' | 'juice' | 'food_truck' | 'bakery'
  | 'ghost_kitchen' | 'hotel' | 'catering' | 'market' | 'cafeteria' | 'gym'

/** Business types you can search. `key` is what the server accepts; it builds the Google query. */
export const BUSINESS_TYPES: { key: string; label: string; emoji: string; category: Category }[] = [
  { key: 'restaurants', label: 'Restaurants', emoji: '🍽️', category: 'restaurant' },
  { key: 'taquerias', label: 'Taquerias', emoji: '🌮', category: 'taqueria' },
  { key: 'mexican', label: 'Mexican & mariscos', emoji: '🦐', category: 'taqueria' },
  { key: 'brunch', label: 'Breakfast & brunch', emoji: '🍳', category: 'restaurant' },
  { key: 'bars', label: 'Bars & pubs', emoji: '🍹', category: 'bar' },
  { key: 'cafes', label: 'Cafes & coffee', emoji: '☕', category: 'cafe' },
  { key: 'juice', label: 'Juice & smoothie bars', emoji: '🥤', category: 'juice' },
  { key: 'food_trucks', label: 'Food trucks', emoji: '🚚', category: 'food_truck' },
  { key: 'bakeries', label: 'Bakeries', emoji: '🥐', category: 'bakery' },
  { key: 'catering', label: 'Catering', emoji: '🍱', category: 'catering' },
  { key: 'hotels', label: 'Hotels w/ restaurant', emoji: '🏨', category: 'hotel' },
  { key: 'markets', label: 'Markets & grocers', emoji: '🛒', category: 'market' },
  { key: 'gyms', label: 'Gyms & wellness', emoji: '💪', category: 'gym' },
  { key: 'cafeterias', label: 'School & hospital cafeterias', emoji: '🏫', category: 'cafeteria' },
  { key: 'ghost_kitchens', label: 'Ghost kitchens', emoji: '👻', category: 'ghost_kitchen' },
]

/** Rough centers of the default El Paso areas (radius in miles) to aim each search. */
export const AREA_CENTERS: Record<string, Point & { radius: number }> = {
  'West Side': { lat: 31.835, lng: -106.555, radius: 4 },
  'Upper Valley': { lat: 31.87, lng: -106.59, radius: 3.5 },
  Downtown: { lat: 31.7595, lng: -106.4869, radius: 1.5 },
  Central: { lat: 31.783, lng: -106.455, radius: 2.5 },
  Northeast: { lat: 31.88, lng: -106.43, radius: 4 },
  'East Side': { lat: 31.775, lng: -106.355, radius: 4 },
  'Far East': { lat: 31.765, lng: -106.26, radius: 4 },
  'Lower Valley': { lat: 31.715, lng: -106.335, radius: 3.5 },
  'Mission Valley': { lat: 31.69, lng: -106.3, radius: 3 },
  'Socorro/Horizon': { lat: 31.665, lng: -106.24, radius: 5 },
}

/** Area center: the built-in one, or the middle of your clients in that area. */
export function areaCenter(area: string, clients: Client[]): (Point & { radius: number }) | null {
  if (AREA_CENTERS[area]) return AREA_CENTERS[area]
  const pts = clients.filter((c) => c.area === area && c.lat != null && c.lng != null)
  if (!pts.length) return null
  return { lat: pts.reduce((s, c) => s + c.lat!, 0) / pts.length, lng: pts.reduce((s, c) => s + c.lng!, 0) / pts.length, radius: 3 }
}

/** National chains buy centrally, so they're a poor fit. You can add more in Settings. */
export const DEFAULT_CHAINS = [
  "McDonald's", 'Taco Bell', 'Starbucks', 'Chick-fil-A', 'Whataburger', 'Subway', "Wendy's", 'Burger King', "Applebee's",
  "Chili's", 'Olive Garden', 'IHOP', "Denny's", 'Panda Express', "Domino's", 'Pizza Hut', 'Little Caesars', 'Sonic',
  'Jack in the Box', "Carl's Jr", "Raising Cane's", 'Popeyes', 'KFC', 'Dunkin', 'Jamba', 'Smoothie King',
  'Tropical Smoothie', 'Buffalo Wild Wings', 'Texas Roadhouse', 'Red Lobster', 'Cracker Barrel', 'Golden Corral',
  'Peter Piper', "Freddy's", "Rudy's", 'Chipotle', 'Qdoba', 'Del Taco', 'Panera', "Jason's Deli", '7-Eleven',
  'Circle K', 'Walmart', 'Albertsons', 'Walgreens', 'CVS', 'Planet Fitness', 'LA Fitness', 'Crunch Fitness',
  'Anytime Fitness', "Gold's Gym", 'Marriott', 'Hilton', 'Hyatt', 'Holiday Inn', 'Hampton Inn', 'Courtyard',
  'Embassy Suites', 'Sam\'s Club', 'Costco', 'H-E-B', "Church's", 'Golden Chick', 'Cici', 'Hooters', 'Twin Peaks',
  'Waffle House', 'Village Inn', 'Luby', "Culver's", 'Five Guys', 'Jersey Mike', "Jimmy John", 'Wingstop', 'Dutch Bros',
]

export interface FitWeights {
  type: number
  independent: number
  busy: number
  near: number
  menu: number
  fresh: number
  open: number
}
export const DEFAULT_FIT_WEIGHTS: FitWeights = { type: 1, independent: 1, busy: 1, near: 1, menu: 1, fresh: 1, open: 1 }
export const FIT_LABEL: Record<keyof FitWeights, string> = {
  type: 'Type buys a lot of what we sell',
  independent: 'Independent / local (not a chain)',
  busy: 'Busy (lots of reviews)',
  near: 'Close to your clients or route',
  menu: 'Menu signals (salads, bowls, brunch, salsa…)',
  fresh: 'New or recently opened',
  open: 'Open now / operating',
}

const TYPE_POINTS: Record<Category, number> = {
  restaurant: 3, taqueria: 3, juice: 3, catering: 3, ghost_kitchen: 2.5, food_truck: 2, cafe: 2, bar: 2,
  hotel: 2, market: 2, cafeteria: 2, bakery: 1.5, gym: 1.5,
}
const CATEGORY_NAME: Record<Category, string> = {
  restaurant: 'restaurant', taqueria: 'taqueria', bar: 'bar', cafe: 'cafe', juice: 'juice bar', food_truck: 'food truck',
  bakery: 'bakery', ghost_kitchen: 'ghost kitchen', hotel: 'hotel', catering: 'caterer', market: 'market', cafeteria: 'cafeteria', gym: 'gym',
}

/** What the place actually is, from Google's type when it's more specific than what you searched. */
export function categoryOf(p: Place, searched: Category): Category {
  const t = `${p.primaryType ?? ''} ${p.types.join(' ')} ${p.name}`.toLowerCase()
  if (/juice|smoothie/.test(t)) return 'juice'
  if (/taco|taqueria|mexican|mariscos/.test(t)) return 'taqueria'
  if (/\bbar\b|pub|brewery|cantina|lounge|wine_bar/.test(t) && searched !== 'restaurant') return 'bar'
  if (/cater/.test(t)) return 'catering'
  if (/bakery|panader/.test(t)) return 'bakery'
  if (/cafe|coffee/.test(t) && searched !== 'restaurant') return 'cafe'
  if (/gym|fitness|yoga|wellness|pilates/.test(t)) return 'gym'
  if (/grocery|market|supermarket/.test(t) && searched === 'market') return 'market'
  return searched
}

export interface FitReason {
  key: keyof FitWeights
  text: string
  points: number
}
export interface Fit {
  score: number
  reasons: FitReason[]
  chain: boolean
  category: Category
  why: string
}

const MENU_WORDS = ['salad', 'bowl', 'smoothie', 'juice', 'salsa', 'pico', 'brunch', 'breakfast', 'vegan', 'vegetarian', 'healthy', 'fresh', 'poke', 'ceviche', 'mariscos', 'acai', 'farm', 'organic', 'garden', 'green']

export interface FitContext {
  clients: Client[]
  routeStops?: Client[]
  chains: string[]
  weights: FitWeights
  /** how often each normalized name appears in the results (3+ = probably a chain) */
  nameCounts: Map<string, number>
}

export const normName = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

export function isChain(p: Place, chains: string[]): boolean {
  const n = normName(p.name)
  return chains.some((c) => {
    const cn = normName(c)
    return cn.length > 2 && (n === cn || n.startsWith(cn + ' ') || n.includes(' ' + cn + ' ') || n.endsWith(' ' + cn))
  })
}

/** Transparent fit score 0–10: every point comes with a reason you can read. */
export function computeFit(p: Place, searched: Category, ctx: FitContext): Fit {
  const w = { ...DEFAULT_FIT_WEIGHTS, ...ctx.weights }
  const category = categoryOf(p, searched)
  const reasons: FitReason[] = []
  const add = (key: keyof FitWeights, base: number, text: string) => {
    const points = base * w[key]
    if (points !== 0) reasons.push({ key, text, points })
  }

  let typePts = TYPE_POINTS[category]
  if (/fast_food/.test(p.primaryType ?? '')) typePts = 0.5
  add('type', typePts, typePts >= 2.5 ? `${cap(CATEGORY_NAME[category])}: buys produce & more` : cap(CATEGORY_NAME[category]))

  const chain = isChain(p, ctx.chains)
  const repeats = ctx.nameCounts.get(normName(p.name)) ?? 1
  if (chain) add('independent', -3, 'National chain (buys centrally)')
  else if (repeats >= 3) add('independent', 0.5, `Local chain (${repeats} locations)`)
  else add('independent', 2, 'Independent')

  const r = p.reviews ?? 0
  if (r >= 400) add('busy', 2, `Busy: ${r >= 1000 ? `${Math.floor(r / 100) / 10}k` : `${Math.floor(r / 100) * 100}+`} reviews`)
  else if (r >= 150) add('busy', 1.5, `${r} reviews`)
  else if (r >= 50) add('busy', 1, `${r} reviews`)

  if (p.lat != null && p.lng != null) {
    const here = { lat: p.lat, lng: p.lng }
    const nearest = (list: Client[]) =>
      list
        .filter((c) => c.lat != null && c.lng != null)
        .map((c) => ({ c, d: miles(here, { lat: c.lat!, lng: c.lng! }) }))
        .sort((a, b) => a.d - b.d)[0]
    const stop = ctx.routeStops?.length ? nearest(ctx.routeStops) : undefined
    const client = nearest(ctx.clients.filter((c) => c.status !== 'lead'))
    const best = stop && stop.d <= 1.5 ? { ...stop, label: "today's stop" } : client ? { ...client, label: 'your client' } : null
    if (best && best.d <= 3) {
      const dist = best.d < 0.25 ? '2 blocks' : `${best.d.toFixed(1)} mi`
      add('near', best.d <= 0.5 ? 2 : best.d <= 1.5 ? 1.2 : 0.6, `${dist} from ${best.label} ${best.c.business_name}`)
    }
  }

  const text = `${p.name} ${p.summary ?? ''} ${p.types.join(' ')}`.toLowerCase()
  const words = MENU_WORDS.filter((m) => text.includes(m))
  if (p.servesBrunch) words.unshift('brunch')
  if (p.servesVegetarian) words.push('vegetarian')
  const menu = [...new Set(words)].slice(0, 3)
  if (menu.length) add('menu', Math.min(1.5, 0.75 + menu.length * 0.25), `Menu: ${menu.join(', ')}`)

  if (r > 0 && r < 40) add('fresh', 1, 'Few reviews, possibly new (still choosing suppliers)')

  if (p.status === 'CLOSED_TEMPORARILY') add('open', -4, 'Temporarily closed')
  else if (p.openNow) add('open', 0.5, 'Open now')

  const raw = reasons.reduce((s, x) => s + x.points, 0)
  const score = Math.max(0, Math.min(10, Math.round((raw / 12) * 100) / 10))
  reasons.sort((a, b) => b.points - a.points)
  return { score, reasons, chain, category, why: whyLine(p, category, reasons) }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** e.g. "Busy taqueria, 400+ reviews, 2 blocks from your client Casa Luna" */
function whyLine(p: Place, category: Category, reasons: FitReason[]): string {
  const parts: string[] = []
  const busy = (p.reviews ?? 0) >= 400
  parts.push(`${busy ? 'Busy ' : ''}${CATEGORY_NAME[category]}`)
  const r = reasons.find((x) => x.key === 'busy')
  if (r) parts.push(r.text.replace('Busy: ', ''))
  for (const k of ['near', 'menu', 'fresh', 'independent'] as const) {
    const x = reasons.find((y) => y.key === k)
    if (x && (k !== 'independent' || x.points < 0)) parts.push(x.text)
  }
  return cap(parts.slice(0, 3).join(', '))
}

/** Top two product lines to lead with, plus an opening line, by business type. */
export function prospectPitch(category: Category, p: Pick<Place, 'name' | 'servesBrunch' | 'servesCocktails'>): { lines: [ProductLine, ProductLine]; en: string; es: string } {
  switch (category) {
    case 'juice':
      return { lines: ['cold_pressed', 'produce'], en: `Hi! I'm with Dua Food, a local family distributor. We deliver fresh produce and cold-pressed juices in El Paso. Could I drop off some fruit and a few bottles for you to try?`, es: `¡Hola! Soy de Dua Food, una distribuidora local y familiar. Entregamos fruta y verdura fresca y jugos prensados en frío aquí en El Paso. ¿Le puedo dejar fruta y unas botellas para que las pruebe?` }
    case 'gym':
      return { lines: ['cold_pressed', 'produce'], en: `Hi! I'm with Dua Food, local and family-owned. Our cold-pressed juices sell well at gyms and wellness studios: high margin, no prep. Can I leave a few samples for your members?`, es: `¡Hola! Soy de Dua Food, empresa local y familiar. Nuestros jugos prensados en frío se venden muy bien en gimnasios: buen margen y sin preparación. ¿Le dejo unas muestras para sus clientes?` }
    case 'taqueria':
      return { lines: ['produce', 'prepped_veg'], en: `Hi! I'm with Dua Food, a local family distributor. We deliver fresh produce and prepped veggies (diced onion, cilantro, pico mix) that save your kitchen prep time. Can I bring you a sample and a price sheet?`, es: `¡Hola! Soy de Dua Food, una distribuidora local y familiar. Entregamos verdura fresca y ya preparada (cebolla picada, cilantro, pico de gallo) para ahorrarle tiempo en la cocina. ¿Le traigo una muestra y la lista de precios?` }
    case 'bar':
      return { lines: ['commercial_juice', 'produce'], en: `Hi! I'm with Dua Food, local and family-owned. We supply bar juices (OJ, cranberry, pineapple, lime) plus garnish produce, all on one delivery. Can I send you our price list?`, es: `¡Hola! Soy de Dua Food, empresa local y familiar. Surtimos jugos para bar (naranja, arándano, piña, limón) y fruta para garnish, todo en una sola entrega. ¿Le mando nuestra lista de precios?` }
    case 'cafe':
      return { lines: ['cold_pressed', 'produce'], en: `Hi! I'm with Dua Food, a local family distributor. Our cold-pressed juices are an easy grab-and-go add, and we deliver fresh produce too. Can I drop off a few bottles to try?`, es: `¡Hola! Soy de Dua Food, una distribuidora local y familiar. Nuestros jugos prensados en frío son fáciles de vender para llevar, y también entregamos fruta y verdura fresca. ¿Le dejo unas botellas para probar?` }
    case 'bakery':
      return { lines: ['produce', 'commercial_juice'], en: `Hi! I'm with Dua Food, local and family-owned. We deliver fresh fruit for baking and juices for your case, priced every week. Can I bring you a price sheet?`, es: `¡Hola! Soy de Dua Food, empresa local y familiar. Entregamos fruta fresca para repostería y jugos para su vitrina, con precios cada semana. ¿Le traigo la lista de precios?` }
    case 'catering':
    case 'cafeteria':
    case 'ghost_kitchen':
      return { lines: ['prepped_veg', 'produce'], en: `Hi! I'm with Dua Food, a local family distributor. Our prepped veggies come diced, sliced and shredded, ready for volume, with fresh produce on the same truck. Can I bring you a sample tray?`, es: `¡Hola! Soy de Dua Food, una distribuidora local y familiar. Nuestra verdura preparada viene picada, rebanada y rallada, lista para volumen, y la verdura fresca viene en el mismo camión. ¿Le traigo una charola de muestra?` }
    case 'food_truck':
      return { lines: ['prepped_veg', 'produce'], en: `Hi! I'm with Dua Food, local and family-owned. We deliver prepped veggies and fresh produce so you can prep less in a small kitchen. Want to try a sample?`, es: `¡Hola! Soy de Dua Food, empresa local y familiar. Le entregamos verdura preparada y fresca para que prepare menos en una cocina pequeña. ¿Quiere probar una muestra?` }
    case 'hotel':
      return { lines: ['produce', 'commercial_juice'], en: `Hi! I'm with Dua Food, a local family distributor. We supply fresh produce and breakfast juices for hotel kitchens, delivered on your schedule. Who handles your purchasing?`, es: `¡Hola! Soy de Dua Food, una distribuidora local y familiar. Surtimos fruta y verdura fresca y jugos para desayuno a cocinas de hotel, en el horario que necesite. ¿Quién se encarga de las compras?` }
    case 'market':
      return { lines: ['produce', 'cold_pressed'], en: `Hi! I'm with Dua Food, local and family-owned. We deliver fresh produce and bottled cold-pressed juices for your shelves. Can I bring you our weekly price sheet?`, es: `¡Hola! Soy de Dua Food, empresa local y familiar. Entregamos fruta y verdura fresca y jugos prensados en frío embotellados para sus anaqueles. ¿Le traigo nuestra lista de precios semanal?` }
    default:
      return p.servesBrunch
        ? { lines: ['produce', 'cold_pressed'], en: `Hi! I'm with Dua Food, a local family distributor. We deliver fresh produce plus cold-pressed juices that fit a brunch menu. Can I drop off a sample?`, es: `¡Hola! Soy de Dua Food, una distribuidora local y familiar. Entregamos fruta y verdura fresca y jugos prensados en frío ideales para un menú de brunch. ¿Le dejo una muestra?` }
        : { lines: ['produce', 'prepped_veg'], en: `Hi! I'm with Dua Food, a local family distributor. We deliver fresh produce and prepped veggies, priced weekly, with a real person (me) you can call. Can I bring you a sample and our price sheet?`, es: `¡Hola! Soy de Dua Food, una distribuidora local y familiar. Entregamos fruta y verdura fresca y verdura preparada, con precios cada semana y una persona real (yo) a quien llamar. ¿Le traigo una muestra y la lista de precios?` }
  }
}

/** Is this place already one of your clients or leads? Matches Google ID, phone, or name + location. */
export function findExisting(p: Place, clients: Client[]): Client | null {
  const digits = (s: string | null) => (s ?? '').replace(/\D/g, '').slice(-10)
  const phone = digits(p.phone)
  const name = normName(p.name)
  for (const c of clients) {
    if (c.google_place_id && c.google_place_id === p.id) return c
    if (phone.length === 10 && digits(c.phone) === phone) return c
    if (normName(c.business_name) === name) {
      if (c.lat == null || p.lat == null) return c
      if (miles({ lat: c.lat, lng: c.lng! }, { lat: p.lat, lng: p.lng! }) < 0.3) return c
    }
  }
  return null
}

/** Tap-to-open links only: we never scrape social sites, we just search for the business there. */
export function socialSearchLinks(p: Pick<Place, 'name'>) {
  const q = (site: string) => `https://www.google.com/search?q=${encodeURIComponent(`${p.name} El Paso site:${site}`)}`
  return { instagram: q('instagram.com'), facebook: q('facebook.com') }
}

export const PRICE_LABEL = ['Free', '$', '$$', '$$$', '$$$$']
