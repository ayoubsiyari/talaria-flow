/**
 * ISO-3166-1 alpha-2 countries with English and Arabic names.
 */
(function () {
  var ROWS = [
    ['AF', 'Afghanistan', 'أفغانستان'],
    ['AX', 'Åland Islands', 'جزر آلاند'],
    ['AL', 'Albania', 'ألبانيا'],
    ['DZ', 'Algeria', 'الجزائر'],
    ['AS', 'American Samoa', 'ساموا الأمريكية'],
    ['AD', 'Andorra', 'أندورا'],
    ['AO', 'Angola', 'أنغولا'],
    ['AI', 'Anguilla', 'أنغويلا'],
    ['AQ', 'Antarctica', 'أنتاركتيكا'],
    ['AG', 'Antigua and Barbuda', 'أنتيغوا وبربودا'],
    ['AR', 'Argentina', 'الأرجنتين'],
    ['AM', 'Armenia', 'أرمينيا'],
    ['AW', 'Aruba', 'أروبا'],
    ['AU', 'Australia', 'أستراليا'],
    ['AT', 'Austria', 'النمسا'],
    ['AZ', 'Azerbaijan', 'أذربيجان'],
    ['BS', 'Bahamas', 'جزر البهاما'],
    ['BH', 'Bahrain', 'البحرين'],
    ['BD', 'Bangladesh', 'بنغلاديش'],
    ['BB', 'Barbados', 'بربادوس'],
    ['BY', 'Belarus', 'بيلاروس'],
    ['BE', 'Belgium', 'بلجيكا'],
    ['BZ', 'Belize', 'بليز'],
    ['BJ', 'Benin', 'بنين'],
    ['BM', 'Bermuda', 'برمودا'],
    ['BT', 'Bhutan', 'بوتان'],
    ['BO', 'Bolivia', 'بوليفيا'],
    ['BQ', 'Bonaire, Sint Eustatius and Saba', 'بونير وسانت يوستاتيوس وسابا'],
    ['BA', 'Bosnia and Herzegovina', 'البوسنة والهرسك'],
    ['BW', 'Botswana', 'بوتسوانا'],
    ['BV', 'Bouvet Island', 'جزيرة بوفيه'],
    ['BR', 'Brazil', 'البرازيل'],
    ['IO', 'British Indian Ocean Territory', 'الإقليم البريطاني في المحيط الهندي'],
    ['BN', 'Brunei Darussalam', 'بروناي دار السلام'],
    ['BG', 'Bulgaria', 'بلغاريا'],
    ['BF', 'Burkina Faso', 'بوركينا فاسو'],
    ['BI', 'Burundi', 'بوروندي'],
    ['CV', 'Cabo Verde', 'كابو فيردي'],
    ['KH', 'Cambodia', 'كمبوديا'],
    ['CM', 'Cameroon', 'الكاميرون'],
    ['CA', 'Canada', 'كندا'],
    ['KY', 'Cayman Islands', 'جزر كايمان'],
    ['CF', 'Central African Republic', 'جمهورية أفريقيا الوسطى'],
    ['TD', 'Chad', 'تشاد'],
    ['CL', 'Chile', 'تشيلي'],
    ['CN', 'China', 'الصين'],
    ['CX', 'Christmas Island', 'جزيرة كريسماس'],
    ['CC', 'Cocos (Keeling) Islands', 'جزر كوكوس'],
    ['CO', 'Colombia', 'كولومبيا'],
    ['KM', 'Comoros', 'جزر القمر'],
    ['CG', 'Congo', 'الكونغو'],
    ['CD', 'Congo, Democratic Republic of the', 'جمهورية الكونغو الديمقراطية'],
    ['CK', 'Cook Islands', 'جزر كوك'],
    ['CR', 'Costa Rica', 'كوستاريكا'],
    ['CI', 'Côte d’Ivoire', 'كوت ديفوار'],
    ['HR', 'Croatia', 'كرواتيا'],
    ['CU', 'Cuba', 'كوبا'],
    ['CW', 'Curaçao', 'كوراساو'],
    ['CY', 'Cyprus', 'قبرص'],
    ['CZ', 'Czechia', 'تشيكيا'],
    ['DK', 'Denmark', 'الدانمرك'],
    ['DJ', 'Djibouti', 'جيبوتي'],
    ['DM', 'Dominica', 'دومينيكا'],
    ['DO', 'Dominican Republic', 'الجمهورية الدومينيكية'],
    ['EC', 'Ecuador', 'الإكوادور'],
    ['EG', 'Egypt', 'مصر'],
    ['SV', 'El Salvador', 'السلفادور'],
    ['GQ', 'Equatorial Guinea', 'غينيا الاستوائية'],
    ['ER', 'Eritrea', 'إريتريا'],
    ['EE', 'Estonia', 'إستونيا'],
    ['SZ', 'Eswatini', 'إسواتيني'],
    ['ET', 'Ethiopia', 'إثيوبيا'],
    ['FK', 'Falkland Islands', 'جزر فوكلاند'],
    ['FO', 'Faroe Islands', 'جزر فارو'],
    ['FJ', 'Fiji', 'فيجي'],
    ['FI', 'Finland', 'فنلندا'],
    ['FR', 'France', 'فرنسا'],
    ['GF', 'French Guiana', 'غويانا الفرنسية'],
    ['PF', 'French Polynesia', 'بولينيزيا الفرنسية'],
    ['TF', 'French Southern Territories', 'الأراضي الفرنسية الجنوبية'],
    ['GA', 'Gabon', 'الغابون'],
    ['GM', 'Gambia', 'غامبيا'],
    ['GE', 'Georgia', 'جورجيا'],
    ['DE', 'Germany', 'ألمانيا'],
    ['GH', 'Ghana', 'غانا'],
    ['GI', 'Gibraltar', 'جبل طارق'],
    ['GR', 'Greece', 'اليونان'],
    ['GL', 'Greenland', 'غرينلاند'],
    ['GD', 'Grenada', 'غرينادا'],
    ['GP', 'Guadeloupe', 'غوادلوب'],
    ['GU', 'Guam', 'غوام'],
    ['GT', 'Guatemala', 'غواتيمالا'],
    ['GG', 'Guernsey', 'غيرنزي'],
    ['GN', 'Guinea', 'غينيا'],
    ['GW', 'Guinea-Bissau', 'غينيا بيساو'],
    ['GY', 'Guyana', 'غيانا'],
    ['HT', 'Haiti', 'هايتي'],
    ['HM', 'Heard Island and McDonald Islands', 'جزيرة هيرد وجزر ماكدونالد'],
    ['VA', 'Holy See', 'الكرسي الرسولي'],
    ['HN', 'Honduras', 'هندوراس'],
    ['HK', 'Hong Kong', 'هونغ كونغ'],
    ['HU', 'Hungary', 'هنغاريا'],
    ['IS', 'Iceland', 'آيسلندا'],
    ['IN', 'India', 'الهند'],
    ['ID', 'Indonesia', 'إندونيسيا'],
    ['IR', 'Iran', 'إيران'],
    ['IQ', 'Iraq', 'العراق'],
    ['IE', 'Ireland', 'أيرلندا'],
    ['IM', 'Isle of Man', 'جزيرة مان'],
    ['IL', 'Israel', 'إسرائيل'],
    ['IT', 'Italy', 'إيطاليا'],
    ['JM', 'Jamaica', 'جامايكا'],
    ['JP', 'Japan', 'اليابان'],
    ['JE', 'Jersey', 'جيرزي'],
    ['JO', 'Jordan', 'الأردن'],
    ['KZ', 'Kazakhstan', 'كازاخستان'],
    ['KE', 'Kenya', 'كينيا'],
    ['KI', 'Kiribati', 'كيريباتي'],
    ['KP', 'Korea, Democratic People’s Republic of', 'جمهورية كوريا الشعبية الديمقراطية'],
    ['KR', 'Korea, Republic of', 'جمهورية كوريا'],
    ['KW', 'Kuwait', 'الكويت'],
    ['KG', 'Kyrgyzstan', 'قيرغيزستان'],
    ['LA', 'Lao People’s Democratic Republic', 'جمهورية لاو الديمقراطية الشعبية'],
    ['LV', 'Latvia', 'لاتفيا'],
    ['LB', 'Lebanon', 'لبنان'],
    ['LS', 'Lesotho', 'ليسوتو'],
    ['LR', 'Liberia', 'ليبيريا'],
    ['LY', 'Libya', 'ليبيا'],
    ['LI', 'Liechtenstein', 'ليختنشتاين'],
    ['LT', 'Lithuania', 'ليتوانيا'],
    ['LU', 'Luxembourg', 'لكسمبرغ'],
    ['MO', 'Macao', 'ماكاو'],
    ['MG', 'Madagascar', 'مدغشقر'],
    ['MW', 'Malawi', 'ملاوي'],
    ['MY', 'Malaysia', 'ماليزيا'],
    ['MV', 'Maldives', 'ملديف'],
    ['ML', 'Mali', 'مالي'],
    ['MT', 'Malta', 'مالطة'],
    ['MH', 'Marshall Islands', 'جزر مارشال'],
    ['MQ', 'Martinique', 'مارتينيك'],
    ['MR', 'Mauritania', 'موريتانيا'],
    ['MU', 'Mauritius', 'موريشيوس'],
    ['YT', 'Mayotte', 'مايوت'],
    ['MX', 'Mexico', 'المكسيك'],
    ['FM', 'Micronesia', 'ميكرونيزيا'],
    ['MD', 'Moldova', 'مولدوفا'],
    ['MC', 'Monaco', 'موناكو'],
    ['MN', 'Mongolia', 'منغوليا'],
    ['ME', 'Montenegro', 'الجبل الأسود'],
    ['MS', 'Montserrat', 'مونتسرات'],
    ['MA', 'Morocco', 'المغرب'],
    ['MZ', 'Mozambique', 'موزمبيق'],
    ['MM', 'Myanmar', 'ميانمار'],
    ['NA', 'Namibia', 'ناميبيا'],
    ['NR', 'Nauru', 'ناورو'],
    ['NP', 'Nepal', 'نيبال'],
    ['NL', 'Netherlands', 'هولندا'],
    ['NC', 'New Caledonia', 'كاليدونيا الجديدة'],
    ['NZ', 'New Zealand', 'نيوزيلندا'],
    ['NI', 'Nicaragua', 'نيكاراغوا'],
    ['NE', 'Niger', 'النيجر'],
    ['NG', 'Nigeria', 'نيجيريا'],
    ['NU', 'Niue', 'نيوي'],
    ['NF', 'Norfolk Island', 'جزيرة نورفولك'],
    ['MK', 'North Macedonia', 'مقدونيا الشمالية'],
    ['MP', 'Northern Mariana Islands', 'جزر ماريانا الشمالية'],
    ['NO', 'Norway', 'النرويج'],
    ['OM', 'Oman', 'عُمان'],
    ['PK', 'Pakistan', 'باكستان'],
    ['PW', 'Palau', 'بالاو'],
    ['PS', 'Palestine, State of', 'دولة فلسطين'],
    ['PA', 'Panama', 'بنما'],
    ['PG', 'Papua New Guinea', 'بابوا غينيا الجديدة'],
    ['PY', 'Paraguay', 'باراغواي'],
    ['PE', 'Peru', 'بيرو'],
    ['PH', 'Philippines', 'الفلبين'],
    ['PN', 'Pitcairn', 'بيتكيرن'],
    ['PL', 'Poland', 'بولندا'],
    ['PT', 'Portugal', 'البرتغال'],
    ['PR', 'Puerto Rico', 'بورتوريكو'],
    ['QA', 'Qatar', 'قطر'],
    ['RE', 'Réunion', 'لا ريونيون'],
    ['RO', 'Romania', 'رومانيا'],
    ['RU', 'Russian Federation', 'الاتحاد الروسي'],
    ['RW', 'Rwanda', 'رواندا'],
    ['BL', 'Saint Barthélemy', 'سان بارتليمي'],
    ['SH', 'Saint Helena, Ascension and Tristan da Cunha', 'سانت هيلانة وأسنسيون وتريستان دا كونا'],
    ['KN', 'Saint Kitts and Nevis', 'سانت كيتس ونيفيس'],
    ['LC', 'Saint Lucia', 'سانت لوسيا'],
    ['MF', 'Saint Martin', 'سان مارتن'],
    ['PM', 'Saint Pierre and Miquelon', 'سان بيير وميكلون'],
    ['VC', 'Saint Vincent and the Grenadines', 'سانت فنسنت وجزر غرينادين'],
    ['WS', 'Samoa', 'ساموا'],
    ['SM', 'San Marino', 'سان مارينو'],
    ['ST', 'Sao Tome and Principe', 'ساو تومي وبرينسيبي'],
    ['SA', 'Saudi Arabia', 'المملكة العربية السعودية'],
    ['SN', 'Senegal', 'السنغال'],
    ['RS', 'Serbia', 'صربيا'],
    ['SC', 'Seychelles', 'سيشل'],
    ['SL', 'Sierra Leone', 'سيراليون'],
    ['SG', 'Singapore', 'سنغافورة'],
    ['SX', 'Sint Maarten', 'سانت مارتن'],
    ['SK', 'Slovakia', 'سلوفاكيا'],
    ['SI', 'Slovenia', 'سلوفينيا'],
    ['SB', 'Solomon Islands', 'جزر سليمان'],
    ['SO', 'Somalia', 'الصومال'],
    ['ZA', 'South Africa', 'جنوب أفريقيا'],
    ['GS', 'South Georgia and the South Sandwich Islands', 'جورجيا الجنوبية وجزر ساندويتش الجنوبية'],
    ['SS', 'South Sudan', 'جنوب السودان'],
    ['ES', 'Spain', 'إسبانيا'],
    ['LK', 'Sri Lanka', 'سري لانكا'],
    ['SD', 'Sudan', 'السودان'],
    ['SR', 'Suriname', 'سورينام'],
    ['SJ', 'Svalbard and Jan Mayen', 'سفالبارد ويان ماين'],
    ['SE', 'Sweden', 'السويد'],
    ['CH', 'Switzerland', 'سويسرا'],
    ['SY', 'Syrian Arab Republic', 'الجمهورية العربية السورية'],
    ['TW', 'Taiwan', 'تايوان'],
    ['TJ', 'Tajikistan', 'طاجيكستان'],
    ['TZ', 'Tanzania', 'تنزانيا'],
    ['TH', 'Thailand', 'تايلند'],
    ['TL', 'Timor-Leste', 'تيمور - ليشتي'],
    ['TG', 'Togo', 'توغو'],
    ['TK', 'Tokelau', 'توكيلاو'],
    ['TO', 'Tonga', 'تونغا'],
    ['TT', 'Trinidad and Tobago', 'ترينيداد وتوباغو'],
    ['TN', 'Tunisia', 'تونس'],
    ['TR', 'Türkiye', 'تركيا'],
    ['TM', 'Turkmenistan', 'تركمانستان'],
    ['TC', 'Turks and Caicos Islands', 'جزر توركس وكايكوس'],
    ['TV', 'Tuvalu', 'توفالو'],
    ['UG', 'Uganda', 'أوغندا'],
    ['UA', 'Ukraine', 'أوكرانيا'],
    ['AE', 'United Arab Emirates', 'الإمارات العربية المتحدة'],
    ['GB', 'United Kingdom', 'المملكة المتحدة'],
    ['US', 'United States', 'الولايات المتحدة'],
    ['UM', 'United States Minor Outlying Islands', 'جزر الولايات المتحدة النائية'],
    ['UY', 'Uruguay', 'أوروغواي'],
    ['UZ', 'Uzbekistan', 'أوزبكستان'],
    ['VU', 'Vanuatu', 'فانواتو'],
    ['VE', 'Venezuela', 'فنزويلا'],
    ['VN', 'Viet Nam', 'فييت نام'],
    ['VG', 'Virgin Islands (British)', 'جزر فرجن البريطانية'],
    ['VI', 'Virgin Islands (U.S.)', 'جزر فرجن التابعة للولايات المتحدة'],
    ['WF', 'Wallis and Futuna', 'واليس وفوتونا'],
    ['EH', 'Western Sahara', 'الصحراء الغربية'],
    ['YE', 'Yemen', 'اليمن'],
    ['ZM', 'Zambia', 'زامبيا'],
    ['ZW', 'Zimbabwe', 'زمبابوي']
  ];

  var list = ROWS.map(function (r) {
    return { code: r[0], en: r[1], ar: r[2] };
  });

  window.TF = window.TF || {};
  window.TF_COUNTRIES = list;
  window.TF.countries = list;

  window.TF.countryName = function (code, lang) {
    var row = list.filter(function (c) { return c.code === code; })[0];
    if (!row) return code || '';
    return lang === 'ar' ? row.ar : row.en;
  };

  window.TF.fillCountrySelect = function (sel, lang, selected) {
    if (!sel) return;
    var ar = lang === 'ar';
    var ph = ar ? 'اختر دولتك' : 'Select your country';
    var hidden = sel;
    var host = sel;
    if (sel.tagName === 'INPUT') {
      host = document.getElementById(sel.id ? sel.id + '-host' : '') || sel.previousElementSibling;
      if (!host || (sel.id && host.id !== sel.id + '-host')) {
        host = document.createElement('div');
        if (sel.id) host.id = sel.id + '-host';
        sel.parentNode.insertBefore(host, sel);
      }
    } else if (sel.tagName !== 'DIV') {
      hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.id = sel.id || '';
      hidden.name = sel.getAttribute('name') || 'country';
      if (sel.required) hidden.required = true;
      var ac = sel.getAttribute('autocomplete');
      if (ac) hidden.setAttribute('autocomplete', ac);
      var described = sel.getAttribute('aria-describedby');
      if (described) hidden.setAttribute('aria-describedby', described);
      host = document.createElement('div');
      if (sel.id) host.id = sel.id + '-host';
      sel.parentNode.replaceChild(host, sel);
      host.parentNode.insertBefore(hidden, host.nextSibling);
    }
    var cur = selected != null ? selected : hidden.value;
    var sorted = list.slice().sort(function (a, b) {
      return (ar ? a.ar : a.en).localeCompare(ar ? b.ar : b.en, ar ? 'ar' : 'en');
    });
    var options = sorted.map(function (c) {
      return { value: c.code, label: ar ? c.ar : c.en };
    });
    hidden.value = cur || '';
    if (!window.TF.mountSelect) return;
    window.TF.mountSelect(host, {
      value: cur || '',
      options: options,
      ariaLabel: ph,
      onChange: function (code) {
        hidden.value = code;
        hidden.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  };
})();
