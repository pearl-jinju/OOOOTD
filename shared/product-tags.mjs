export const PRODUCT_TAG_VERSION = 1;

const rules = {
  tone: {
    dark: /블랙|검정|네이비|차콜|딥.?블루|\b(?:black|navy|charcoal)\b/i,
    light: /화이트|흰색|아이보리|크림|라이트.?그레이|페일|\b(?:white|ivory|cream|pale)\b/i,
    muted: /뮤트|더스티|애쉬|저채도|\b(?:muted|dusty|ash)\b/i,
    vivid: /비비드|네온|형광|\b(?:vivid|neon)\b/i,
    earthy: /카키|올리브|브라운|베이지|\b(?:khaki|olive|brown|beige)\b/i
  },
  fit: {
    wide: /와이드|벌룬|\b(?:wide|balloon)\b/i,
    oversized: /오버핏|오버사이즈|드롭.?숄더|\b(?:oversize[d]?|drop[ -]shoulder)\b/i,
    relaxed: /루즈핏|릴랙스|여유핏|\b(?:loose|relaxed)\b/i,
    slim: /슬림핏|스키니|\b(?:slim|skinny)\b/i,
    straight: /스트레이트|일자핏|\bstraight\b/i,
    regular: /레귤러핏|스탠다드핏|\b(?:regular|standard)[ -]fit\b/i
  },
  length: {
    cropped: /크롭|\bcropped?\b/i,
    short: /반팔|민소매|쇼츠|반바지|\b(?:short[ -]sleeve|sleeveless|shorts)\b/i,
    long: /롱기장|맥시|긴팔|\b(?:maxi|long[ -]sleeve|long[ -]length)\b/i
  },
  pattern: {
    solid: /무지|솔리드|\b(?:solid|plain)\b/i,
    stripe: /스트라이프|줄무늬|\bstrip(?:e[sd]?|ed)\b/i,
    check: /체크|격자|타탄|깅엄|\b(?:check(?:ed)?|plaid|tartan|gingham)\b/i,
    floral: /플로럴|꽃무늬|\bfloral\b/i,
    graphic: /그래픽|프린트|\b(?:graphic|print(?:ed)?)\b/i,
    polka: /도트|땡땡이|\bpolka\b/i
  },
  texture: {
    ribbed: /골지|리브드|\bribbed\b/i,
    washed: /워싱|\bwashed\b/i,
    quilted: /퀼팅|\bquilted\b/i,
    pleated: /플리츠|주름가공|\bpleated\b/i
  },
  material: {
    cotton: /코튼|면 ?100%|\bcotton\b/i,
    linen: /린넨|리넨|\blinen\b/i,
    wool: /울 ?혼방|울 ?\d+%|울[ -]|모직|\bwool\b/i,
    denim: /데님|\bdenim\b/i,
    leather: /가죽|레더|\bleather\b/i,
    fleece: /플리스|후리스|\bfleece\b/i,
    nylon: /나일론|\bnylon\b/i,
    corduroy: /코듀로이|골덴|\bcorduroy\b/i,
    suede: /스웨이드|\bsuede\b/i
  },
  weight: {
    lightweight: /경량|초경량|\blightweight\b/i,
    heavyweight: /헤비웨이트|고중량|\bheavyweight\b/i,
    lined: /기모|안감|\b(?:fleece[ -]lined|brushed lining)\b/i
  },
  feature: {
    waterproof: /방수|\bwaterproof\b/i,
    waterRepellent: /발수|\bwater[ -]repellent\b/i,
    stretch: /신축|스트레치|\bstretch\b/i
  }
};

export function productTags(item) {
  const title = String(item.name || '');
  const toneSource = /멀티.?컬러|색상.?선택|\d+\s*(?:컬러|colou?rs?)|[/|]/i.test(title) ? '' : title;
  const tags = {};
  for (const [axis, variants] of Object.entries(rules)) {
    const source = axis === 'tone' ? toneSource : title;
    const matched = Object.keys(variants).filter(tag => variants[tag].test(source));
    if (matched.length) tags[axis] = matched;
  }
  if (tags.tone?.length > 1) delete tags.tone;
  return tags;
}

export function withProductTags(item) {
  if (item.productTagVersion === PRODUCT_TAG_VERSION && item.productTags) return item;
  return {...item, productTagVersion: PRODUCT_TAG_VERSION, productTags: productTags(item)};
}

const signatures = new WeakMap();
function signature(item) {
  if (!signatures.has(item)) {
    const {productTags} = withProductTags(item);
    signatures.set(item, [
      productTags.tone?.join(',') || item.color,
      productTags.fit?.join(','),
      productTags.length?.join(','),
      productTags.pattern?.join(','),
      productTags.texture?.join(','),
      productTags.material?.join(','),
      productTags.weight?.join(',')
    ]);
  }
  return signatures.get(item);
}

export function outfitTagDistance(items, previous) {
  return items.reduce((sum, item, index) => {
    const before = previous[index];
    if (!before || before.id === item.id) return sum;
    const prior = signature(before);
    return sum + signature(item).filter((value, axis) => value && prior[axis] && value !== prior[axis]).length;
  }, 0);
}
