function createProductDetails({ title, colorLabel, colorHex, productNumber, type = "top" }) {
  const isBottom = type === "bottom";

  return {
    productNumber,
    colors: [
      { label: "Black", hex: "#111111" },
      { label: colorLabel, hex: colorHex },
      { label: "Bone", hex: "#dedbd4" }
    ],
    sizes: ["M", "L", "XL"],
    bullets: [
      `${title} with a clean, structured silhouette`,
      "Midweight fabric selected for everyday wear",
      "Relaxed proportions for layering and movement"
    ],
    description: [
      `${title} balances a concise profile with considered everyday utility. The construction is kept minimal so the shape, texture, and proportion remain the focus.`,
      "Designed as an adaptable wardrobe layer with a comfortable hand feel and an easy, contemporary fit."
    ],
    fitGuide: [
      "M for a closer fit",
      "L for a regular fit",
      "XL for a relaxed fit"
    ],
    code: `#${productNumber}`,
    measurements: isBottom
      ? [
          ["Waist", "72", "78", "84"],
          ["Hip", "104", "110", "116"],
          ["Length", "45", "47", "49"]
        ]
      : [
          ["Shoulder", "56", "59", "62"],
          ["Chest", "60", "63", "66"],
          ["Length", "68", "71", "74"]
        ]
  };
}

window.PARADIGM_CATALOG = {
  products: [
    {
      slug: "prdm-cosmos-hoodie",
      productNumber: "BD24021",
      title: "PRDM Cosmos Hoodie",
      category: "AW Tops",
      price: "NT$1380",
      image: "assets/images/products/BD24021/cosmos-hoodie-01.webp",
      images: [
        "assets/images/products/BD24021/cosmos-hoodie-01.webp",
        "assets/images/products/BD24021/cosmos-hoodie-02.webp",
        "assets/images/products/BD24021/cosmos-hoodie-03.webp",
        "assets/images/products/BD24021/cosmos-hoodie-04.webp",
        "assets/images/products/BD24021/cosmos-hoodie-05.webp",
        "assets/images/products/BD24021/cosmos-hoodie-06.webp",
        "assets/images/products/BD24021/cosmos-hoodie-07.webp"
      ],
      alt: "Midnight navy PRDM Cosmos Hoodie",
      colors: [
        { label: "Black", hex: "#111111" },
        { label: "61 Midnight", hex: "#1b2b68" },
        { label: "Ash", hex: "#d8d8d8" }
      ],
      sizes: ["M", "L", "XL"],
      bullets: [
        "Printed graphics on front and back",
        "100% cotton loopback jersey of 350 g/sqm",
        "Boxy silhouette and longer-back cutting",
        "Watch pocket inside the kangaroo pocket",
        "Signature tab on sleeve"
      ],
      description: [
        "-",
        "西元 1543 年，波蘭數士哥白尼出版《天體運行論》，提出近乎異端的日心說為科學革命揭開序幕。哥白尼指出月球公轉、地球自轉及地球公轉現象，此後百年內伽利略、克卜勒的實際觀測支持終於讓歐洲世界開始接受地球並非宇宙的中心。",
        "然而以銀河系的座標來說，地球並非在一個平面的橢圓軌道上繞太陽公轉。地球公轉的軌道面與銀河系的盤面有著 60° 的交角，而隨著太陽以 230 km/s 的速度繞行銀河系，地球移動的軌跡實際上是以太陽為軸心的螺旋狀。",
        "複雜科學家在五百年來不斷反思與挑戰，無論是否能成為主流常識科學，都已在科學史上留下永恆的註記。正如 Paradigm 致力於奠定宇宙新典範，推動符合當代潮流、不易過時的簡約美學。",
        "這款印花帽 T 的面料是最適合台灣的重磅毛圈布，兼顧外觀的立體感以及優異的舒適度、實穿性。極寬的袖管讓整體輪廓的寬鬆感更一致，微短版的衣長有助於修飾身形比例；選擇小一號的尺寸可以穿出更貼版的效果。我們在口袋內側額外增加了隱藏小口袋，便於放置零錢或是鑰匙、卡片、耳機。"
      ],
      fitGuide: [
        "建議身高 ≤ 173 著 M",
        "建議身高 173–178 著 L",
        "建議身高 ≥ 178 著 XL"
      ],
      code: "#BD24021",
      measurements: [
        ["肩寬", "60.0", "62.5", "65.0"],
        ["胸寬", "63.0", "65.5", "68.0"],
        ["袖長", "60.0", "61.5", "63.0"],
        ["衣長", "68.5", "71.0", "73.5"]
      ],
      shopeeUrl: "https://shopee.tw/"
    },
    {
      slug: "training-shorts",
      title: "Training Shorts",
      category: "Bottoms",
      price: "NT$1180",
      image: "assets/images/products/training-shorts.webp",
      alt: "Brown Paradigm training shorts",
      ...createProductDetails({
        title: "Training Shorts",
        colorLabel: "Graphite",
        colorHex: "#34383b",
        productNumber: "PL-002",
        type: "bottom"
      }),
      shopeeUrl: "https://shopee.tw/"
    },
    {
      slug: "intelligence-hoodie",
      title: "Intelligence Hoodie",
      category: "AW Tops",
      price: "NT$1380",
      image: "assets/images/products/intelligence-hoodie.webp",
      alt: "Navy Paradigm Intelligence Hoodie",
      ...createProductDetails({
        title: "Intelligence Hoodie",
        colorLabel: "Deep Navy",
        colorHex: "#202c4a",
        productNumber: "PL-003"
      }),
      shopeeUrl: "https://shopee.tw/"
    },
    {
      slug: "timeless-crewneck",
      title: "Timeless Crewneck",
      category: "AW Tops",
      price: "NT$1180",
      image: "assets/images/products/timeless-crewneck.webp",
      alt: "Grey Paradigm Timeless Crewneck",
      ...createProductDetails({
        title: "Timeless Crewneck",
        colorLabel: "Heather Grey",
        colorHex: "#a7a8a6",
        productNumber: "PL-004"
      }),
      shopeeUrl: "https://shopee.tw/"
    },
    {
      slug: "aesthetics-tee",
      title: "Aesthetics Tee",
      category: "SS Tops",
      price: "NT$790",
      image: "assets/images/products/aesthetics-tee.webp",
      alt: "White Paradigm Aesthetics Tee",
      ...createProductDetails({
        title: "Aesthetics Tee",
        colorLabel: "Paper White",
        colorHex: "#f2f0e9",
        productNumber: "PL-005"
      }),
      shopeeUrl: "https://shopee.tw/"
    },
    {
      slug: "paradigm-hoodie",
      title: "Paradigm Hoodie",
      category: "AW Tops",
      price: "NT$1380",
      image: "assets/images/products/paradigm-hoodie.webp",
      alt: "Navy Paradigm logo hoodie",
      ...createProductDetails({
        title: "Paradigm Hoodie",
        colorLabel: "Forest",
        colorHex: "#263b32",
        productNumber: "PL-006"
      }),
      shopeeUrl: "https://shopee.tw/"
    },
    {
      slug: "partnership-football-jersey",
      title: "Partnership Football Jersey",
      category: "Teamwear",
      price: "NT$990",
      image: "assets/images/products/partnership-football-jersey.webp",
      alt: "Red Paradigm partnership football jersey",
      ...createProductDetails({
        title: "Partnership Football Jersey",
        colorLabel: "Signal Red",
        colorHex: "#a72d2d",
        productNumber: "PL-007"
      }),
      shopeeUrl: "https://shopee.tw/"
    },
    {
      slug: "everyday-tee",
      title: "Everyday Tee",
      category: "SS Tops",
      price: "NT$590",
      image: "assets/images/products/everyday-tee.webp",
      alt: "Layered Paradigm Everyday Tee",
      ...createProductDetails({
        title: "Everyday Tee",
        colorLabel: "Warm Stone",
        colorHex: "#9c9184",
        productNumber: "PL-008"
      }),
      shopeeUrl: "https://shopee.tw/"
    }
  ]
};

const FIGMA_COSMOS_CAPTION = {
  bullets: [
    "Printed graphics on front and back",
    "100% cotton loopback jersey of 350 g/sqm",
    "Boxy silhouette and longer-back cutting",
    "Watch pocket inside the kangaroo pocket",
    "Signature tab on sleeve"
  ],
  description: [
    "-",
    " ",
    "西元 1543 年 波蘭教士哥白尼出版《天體運行論》",
    "提出近乎異端的日心說 為科學革命揭開序幕",
    "哥白尼指出月球公轉、地球自轉及地球公轉等現象",
    "此後百年內由伽利略、克卜勒的實際觀測支持",
    "終於讓歐洲世界開始接受地球並非宇宙的中心",
    "天體以橢圓軌道公轉因此成為宇宙運行的新典範",
    " ",
    "然而 以銀河系的座標來說",
    "地球並非在一個平面的橢圓軌道上繞太陽公轉",
    "地球公轉的黃道面與銀河系的盤面有著 60° 的夾角",
    "而隨著太陽以 230 km/s 的速度繞行銀河系",
    "地球移動的軌跡實際上是以太陽為軸心的螺旋狀",
    " ",
    "後繼科學家在五百年來不斷改良或挑戰",
    "無論是否能成為主流常態科學",
    "都已在科學史上留下永恆的註記",
    "正如 Paradigm® 致力於奠定穿搭新典範",
    "推動符合當代潮流、不易過時的簡約美學",
    " ",
    "這款印花帽 T 的面料是最適合台灣的重磅毛圈布",
    "兼顧外觀的立體度以及優異的舒適度、實穿性",
    " ",
    "極寬的袖管讓整體輪廓的寬鬆感更一致",
    "微短版的衣長有助於修飾身形比例",
    "選擇小一號的尺寸可以穿出更短版的效果",
    "我們在口袋內側額外增加了隱藏小口袋",
    "便於放置零錢或是鑰匙、卡片、耳機……"
  ],
  fitGuide: [
    "建議身高 ≤ 173 拿 M",
    "建議身高∊173~178 拿 L",
    "建議身高 ≥ 178 拿 XL　(cm)"
  ],
  measurements: [
    ["肩寬", "60.0", "62.5", "65.0"],
    ["胸寬", "63.0", "65.5", "68.0"],
    ["袖長", "60.0", "61.5", "63.0"],
    ["衣長", "68.5", "71.0", "73.5"]
  ]
};

window.PARADIGM_CATALOG.products.forEach((product) => {
  product.bullets = FIGMA_COSMOS_CAPTION.bullets.slice();
  product.description = FIGMA_COSMOS_CAPTION.description.slice();
  product.fitGuide = FIGMA_COSMOS_CAPTION.fitGuide.slice();
  product.measurements = FIGMA_COSMOS_CAPTION.measurements.map((row) => row.slice());
});
