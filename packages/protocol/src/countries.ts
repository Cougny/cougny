import { z } from 'zod';

/**
 * ISO 3166-1 alpha-2 codes for every country recognized by the United Nations:
 * the 193 member states plus the two non-member observer states (the Holy See
 * and the State of Palestine).
 *
 * Deliberately codes only. Display names are resolved per locale at render time
 * with `Intl.DisplayNames`, so this list never carries hardcoded English and a
 * new locale needs no change here.
 */
export const UN_COUNTRY_CODES = [
  'AF', // Afghanistan
  'AL', // Albania
  'DZ', // Algeria
  'AD', // Andorra
  'AO', // Angola
  'AG', // Antigua and Barbuda
  'AR', // Argentina
  'AM', // Armenia
  'AU', // Australia
  'AT', // Austria
  'AZ', // Azerbaijan
  'BS', // Bahamas
  'BH', // Bahrain
  'BD', // Bangladesh
  'BB', // Barbados
  'BY', // Belarus
  'BE', // Belgium
  'BZ', // Belize
  'BJ', // Benin
  'BT', // Bhutan
  'BO', // Bolivia
  'BA', // Bosnia and Herzegovina
  'BW', // Botswana
  'BR', // Brazil
  'BN', // Brunei Darussalam
  'BG', // Bulgaria
  'BF', // Burkina Faso
  'BI', // Burundi
  'CV', // Cabo Verde
  'KH', // Cambodia
  'CM', // Cameroon
  'CA', // Canada
  'CF', // Central African Republic
  'TD', // Chad
  'CL', // Chile
  'CN', // China
  'CO', // Colombia
  'KM', // Comoros
  'CG', // Congo
  'CD', // Congo (Democratic Republic of the)
  'CR', // Costa Rica
  'CI', // Côte d'Ivoire
  'HR', // Croatia
  'CU', // Cuba
  'CY', // Cyprus
  'CZ', // Czechia
  'DK', // Denmark
  'DJ', // Djibouti
  'DM', // Dominica
  'DO', // Dominican Republic
  'EC', // Ecuador
  'EG', // Egypt
  'SV', // El Salvador
  'GQ', // Equatorial Guinea
  'ER', // Eritrea
  'EE', // Estonia
  'SZ', // Eswatini
  'ET', // Ethiopia
  'FJ', // Fiji
  'FI', // Finland
  'FR', // France
  'GA', // Gabon
  'GM', // Gambia
  'GE', // Georgia
  'DE', // Germany
  'GH', // Ghana
  'GR', // Greece
  'GD', // Grenada
  'GT', // Guatemala
  'GN', // Guinea
  'GW', // Guinea-Bissau
  'GY', // Guyana
  'HT', // Haiti
  'VA', // Holy See (observer state)
  'HN', // Honduras
  'HU', // Hungary
  'IS', // Iceland
  'IN', // India
  'ID', // Indonesia
  'IR', // Iran
  'IQ', // Iraq
  'IE', // Ireland
  'IL', // Israel
  'IT', // Italy
  'JM', // Jamaica
  'JP', // Japan
  'JO', // Jordan
  'KZ', // Kazakhstan
  'KE', // Kenya
  'KI', // Kiribati
  'KP', // Korea (Democratic People's Republic of)
  'KR', // Korea (Republic of)
  'KW', // Kuwait
  'KG', // Kyrgyzstan
  'LA', // Lao People's Democratic Republic
  'LV', // Latvia
  'LB', // Lebanon
  'LS', // Lesotho
  'LR', // Liberia
  'LY', // Libya
  'LI', // Liechtenstein
  'LT', // Lithuania
  'LU', // Luxembourg
  'MG', // Madagascar
  'MW', // Malawi
  'MY', // Malaysia
  'MV', // Maldives
  'ML', // Mali
  'MT', // Malta
  'MH', // Marshall Islands
  'MR', // Mauritania
  'MU', // Mauritius
  'MX', // Mexico
  'FM', // Micronesia (Federated States of)
  'MD', // Moldova
  'MC', // Monaco
  'MN', // Mongolia
  'ME', // Montenegro
  'MA', // Morocco
  'MZ', // Mozambique
  'MM', // Myanmar
  'NA', // Namibia
  'NR', // Nauru
  'NP', // Nepal
  'NL', // Netherlands
  'NZ', // New Zealand
  'NI', // Nicaragua
  'NE', // Niger
  'NG', // Nigeria
  'MK', // North Macedonia
  'NO', // Norway
  'OM', // Oman
  'PK', // Pakistan
  'PW', // Palau
  'PS', // Palestine (observer state)
  'PA', // Panama
  'PG', // Papua New Guinea
  'PY', // Paraguay
  'PE', // Peru
  'PH', // Philippines
  'PL', // Poland
  'PT', // Portugal
  'QA', // Qatar
  'RO', // Romania
  'RU', // Russian Federation
  'RW', // Rwanda
  'KN', // Saint Kitts and Nevis
  'LC', // Saint Lucia
  'VC', // Saint Vincent and the Grenadines
  'WS', // Samoa
  'SM', // San Marino
  'ST', // Sao Tome and Principe
  'SA', // Saudi Arabia
  'SN', // Senegal
  'RS', // Serbia
  'SC', // Seychelles
  'SL', // Sierra Leone
  'SG', // Singapore
  'SK', // Slovakia
  'SI', // Slovenia
  'SB', // Solomon Islands
  'SO', // Somalia
  'ZA', // South Africa
  'SS', // South Sudan
  'ES', // Spain
  'LK', // Sri Lanka
  'SD', // Sudan
  'SR', // Suriname
  'SE', // Sweden
  'CH', // Switzerland
  'SY', // Syrian Arab Republic
  'TJ', // Tajikistan
  'TZ', // Tanzania
  'TH', // Thailand
  'TL', // Timor-Leste
  'TG', // Togo
  'TO', // Tonga
  'TT', // Trinidad and Tobago
  'TN', // Tunisia
  'TR', // Türkiye
  'TM', // Turkmenistan
  'TV', // Tuvalu
  'UG', // Uganda
  'UA', // Ukraine
  'AE', // United Arab Emirates
  'GB', // United Kingdom
  'US', // United States of America
  'UY', // Uruguay
  'UZ', // Uzbekistan
  'VU', // Vanuatu
  'VE', // Venezuela
  'VN', // Viet Nam
  'YE', // Yemen
  'ZM', // Zambia
  'ZW', // Zimbabwe
] as const;

/** An ISO 3166-1 alpha-2 code from {@link UN_COUNTRY_CODES}. */
export type CountryCode = (typeof UN_COUNTRY_CODES)[number];

const COUNTRY_CODES: ReadonlySet<string> = new Set<string>(UN_COUNTRY_CODES);

/** Narrows an arbitrary string to a UN-recognized country code. */
export function isCountryCode(value: string): value is CountryCode {
  return COUNTRY_CODES.has(value);
}

/**
 * Country codes are stored and transmitted uppercase. The schema uppercases
 * first so a client sending `"de"` is accepted rather than rejected on a
 * cosmetic difference.
 */
export const CountryCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isCountryCode, { message: 'Must be a UN-recognized ISO 3166-1 alpha-2 country code.' })
  .describe('ISO 3166-1 alpha-2 country code');
