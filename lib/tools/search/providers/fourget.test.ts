import { describe, expect, it } from 'vitest'

import { isInstanceBlocked } from './fourget'

describe('isInstanceBlocked', () => {
  it('detects the yonderly IP ban page', () => {
    expect(
      isInstanceBlocked(
        '<div class="infobox"><h1>Tshh, blocked!</h1>Your browser, IP or IP range has been blocked from this 4get instance.'
      )
    ).toBe(true)
  })

  it('detects anti-bot challenge pages', () => {
    expect(
      isInstanceBlocked(
        '<p class="message">Challenge: please wait for 4 seconds</p>'
      )
    ).toBe(true)
    expect(isInstanceBlocked('<div class="csswaf-hidden"></div>')).toBe(true)
  })

  it('lets normal result pages through', () => {
    expect(
      isInstanceBlocked(
        '<div class="text-result"><a href="https://example.com">x</a></div>'
      )
    ).toBe(false)
    expect(isInstanceBlocked('')).toBe(false)
  })
})
