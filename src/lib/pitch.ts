import type { Client, ProductLine } from './types'

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

/** A short opening line for the suggested product, tailored to what they already buy. */
export function upsellPitch(c: Pick<Client, 'product_lines' | 'contact_name'>, line: ProductLine): string {
  const has = (p: ProductLine) => c.product_lines.includes(p)
  const hi = c.contact_name ? `${c.contact_name.split(' ')[0]}, ` : ''
  switch (line) {
    case 'prepped_veg':
      return has('produce')
        ? `${hi}you already get our produce. We can prep it too (diced onion, pico mix, shredded lettuce) so your crew saves hours of prep. Want a sample tray?`
        : `${hi}our prepped veggies come diced, sliced and shredded, ready to use. Less prep time, less waste. Can I drop off a sample?`
    case 'cold_pressed':
      return has('commercial_juice')
        ? `${hi}for brunch or cocktails, our cold-pressed juices taste fresher than commercial and carry a better margin. Can I leave a few bottles to try?`
        : `${hi}our cold-pressed juices are an easy high-margin add for grab-and-go, brunch or the bar. Can I drop off a few bottles to try?`
    case 'commercial_juice':
      return `${hi}we carry commercial juices too (OJ, cranberry, pineapple, lime) on the same truck as your order. One less vendor to deal with.`
    case 'produce':
      return `${hi}we can bring your fresh produce on the same delivery (tomatoes, onions, cilantro, limes), priced every week. Want me to quote your usual list?`
    default:
      return ''
  }
}
