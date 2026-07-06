import siteMetadata from '@/data/siteMetadata'

function getBuyMeACoffeeSlug(url: string) {
  return url.replace(/\/$/, '').split('/').pop() ?? ''
}

export default function BuyMeACoffee() {
  const { buymeacoffee } = siteMetadata
  if (!buymeacoffee) return null

  const slug = getBuyMeACoffeeSlug(buymeacoffee)
  const buttonImageUrl = `https://img.buymeacoffee.com/button-api/?text=Buy%20me%20a%20coffee&emoji=%E2%98%95&slug=${slug}&button_colour=FFDD00&font_colour=000000&font_family=Lato&outline_colour=000000&coffee_colour=ffffff`

  return (
    <div className="my-8 flex justify-center">
      <a
        href={buymeacoffee}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Buy me a coffee"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={buttonImageUrl} alt="Buy me a coffee" width={217} height={60} />
      </a>
    </div>
  )
}
