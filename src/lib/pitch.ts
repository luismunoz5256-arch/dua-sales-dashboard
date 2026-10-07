import type { Client, ProductLine } from './types.js'

const MAIN: ProductLine[] = ['produce', 'prepped_veg', 'cold_pressed', 'commercial_juice']

/** Which missing product line to pitch first, based on what they already buy. */
export function suggestUpsell(c: Pick<Client, 'product_lines'>): ProductLine | null {
  const has = (p: ProductLine) => c.product_lines.includes(p)
  if (!MAIN.some(has)) return null
  if (has('produce') && !has('prepped_veg')) return 'prepped_veg'
  if (has('commercial_juice') && !has('cold_pressed')) return 'cold_pressed'
  if ((has('prepped_veg') || has('commercial_juice') || has('cold_pressed')) && !has('produce')) return 'produce'
  if (!has('cold_pressed')) return 'cold_pressed'
  if (!has('commercial_juice')) return 'commercial_juice'
  if (!has('prepped_veg')) return 'prepped_veg'
  return null
}

export interface Bilingual {
  en: string
  es: string
}

/** The pitch in the language chosen in Settings ("both" = English, then Spanish). */
export function pitchText(p: Bilingual, lang: 'en' | 'es' | 'both'): string {
  return lang === 'es' ? p.es : lang === 'both' ? `${p.en}\n\n${p.es}` : p.en
}

/** A short opening line for the suggested product, tailored to what they already buy. */
export function upsellPitch(c: Pick<Client, 'product_lines' | 'contact_name'>, line: ProductLine): Bilingual {
  const has = (p: ProductLine) => c.product_lines.includes(p)
  const hi = c.contact_name ? `${c.contact_name.split(' ')[0]}, ` : ''
  switch (line) {
    case 'prepped_veg':
      return has('produce')
        ? {
            en: `${hi}you already get our produce. We can prep it too (diced onion, pico mix, shredded lettuce) so your crew saves hours of prep. Want a sample tray?`,
            es: `${hi}ya le traemos la verdura. También se la podemos traer ya preparada (cebolla picada, pico de gallo, lechuga rallada) para que su cocina ahorre horas de preparación. ¿Le dejo una charola de muestra?`,
          }
        : {
            en: `${hi}our prepped veggies come diced, sliced and shredded, ready to use. Less prep time, less waste. Can I drop off a sample?`,
            es: `${hi}nuestra verdura preparada viene picada, rebanada y rallada, lista para usar. Menos tiempo de preparación y menos desperdicio. ¿Le dejo una muestra?`,
          }
    case 'cold_pressed':
      return has('commercial_juice')
        ? {
            en: `${hi}for brunch or cocktails, our cold-pressed juices taste fresher than commercial and carry a better margin. Can I leave a few bottles to try?`,
            es: `${hi}para el brunch o las bebidas, nuestros jugos prensados en frío saben más frescos que los comerciales y dejan mejor margen. ¿Le dejo unas botellas para que los pruebe?`,
          }
        : {
            en: `${hi}our cold-pressed juices are an easy high-margin add for grab-and-go, brunch or the bar. Can I drop off a few bottles to try?`,
            es: `${hi}nuestros jugos prensados en frío son un producto fácil y con buen margen para llevar, brunch o el bar. ¿Le dejo unas botellas para probar?`,
          }
    case 'commercial_juice':
      return {
        en: `${hi}we carry commercial juices too (OJ, cranberry, pineapple, lime) on the same truck as your order. One less vendor to deal with.`,
        es: `${hi}también manejamos jugos comerciales (naranja, arándano, piña, limón) en el mismo camión que su pedido. Un proveedor menos.`,
      }
    case 'produce':
      return {
        en: `${hi}we can bring your fresh produce on the same delivery (tomatoes, onions, cilantro, limes), priced every week. Want me to quote your usual list?`,
        es: `${hi}le podemos traer la fruta y verdura fresca en la misma entrega (tomate, cebolla, cilantro, limón), con precios cada semana. ¿Le cotizo su lista de siempre?`,
      }
    default:
      return { en: '', es: '' }
  }
}
