/**
 * Banco de imagens web e sugestões automáticas para produtos da loja Big Dog Pet.
 * Fornece fotos de alta resolução, otimizadas e com foco no produto para Pet Shop.
 */

export interface ProductImageItem {
  id: string;
  title: string;
  category: "alimentacao" | "higiene" | "medicamentos" | "acessorios";
  url: string;
  keywords: string[];
}

export const CURATED_PRODUCT_IMAGES: ProductImageItem[] = [
  // Alimentação
  {
    id: "racao-caes-adultos",
    title: "Ração Premium Cães Adultos",
    category: "alimentacao",
    url: "https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=600&auto=format&fit=crop&q=80",
    keywords: ["racao", "caes", "adultos", "premium", "alimentacao", "comida", "cachorro"],
  },
  {
    id: "racao-gatos-castrados",
    title: "Ração Gatos Castrados",
    category: "alimentacao",
    url: "https://images.unsplash.com/photo-1615497001839-b0a0eac3274c?w=600&auto=format&fit=crop&q=80",
    keywords: ["racao", "gatos", "castrados", "felino", "alimentacao", "gato"],
  },
  {
    id: "racao-filhotes",
    title: "Ração para Filhotes",
    category: "alimentacao",
    url: "https://images.unsplash.com/photo-1568640347023-a616a30bc3bd?w=600&auto=format&fit=crop&q=80",
    keywords: ["racao", "filhote", "filhotes", "puppy", "alimentacao"],
  },
  {
    id: "petisco-bifinho",
    title: "Petiscos e Bifinhos Caninos",
    category: "alimentacao",
    url: "https://images.unsplash.com/photo-1582798358481-d199fb7347bb?w=600&auto=format&fit=crop&q=80",
    keywords: ["petisco", "bifinho", "snack", "osso", "biscoito"],
  },

  // Higiene
  {
    id: "shampoo-hipoalergenico",
    title: "Shampoo Hipoalergênico Pet",
    category: "higiene",
    url: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80",
    keywords: ["shampoo", "hipoalergenico", "higiene", "banho", "sabonete", "pele sensivel"],
  },
  {
    id: "escova-creme-dental",
    title: "Kit Escova de Dentes + Creme Dental Pet",
    category: "higiene",
    url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80",
    keywords: ["escova", "dentes", "creme dental", "bucal", "tartaro", "higiene"],
  },
  {
    id: "tapete-higienico",
    title: "Tapete Higiênico Absorvente",
    category: "higiene",
    url: "https://images.unsplash.com/photo-1541599540903-216a46ca1dc0?w=600&auto=format&fit=crop&q=80",
    keywords: ["tapete", "higienico", "xixi", "fralda", "sanitario", "higiene"],
  },
  {
    id: "educador-sanitario",
    title: "Educador Sanitário / Pipi Dog",
    category: "higiene",
    url: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop&q=80",
    keywords: ["educador", "spray", "limpeza", "pipi", "higiene"],
  },

  // Medicamentos
  {
    id: "antipulgas-carrapatos",
    title: "Antipulgas e Carrapatos",
    category: "medicamentos",
    url: "https://images.unsplash.com/photo-1628771065518-0d82f1938462?w=600&auto=format&fit=crop&q=80",
    keywords: ["antipulgas", "carrapato", "pipeta", "pulga", "sarna", "bravecto", "simparic", "medicamentos"],
  },
  {
    id: "vermifugo-caes-gatos",
    title: "Vermífugo Cães e Gatos",
    category: "medicamentos",
    url: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&auto=format&fit=crop&q=80",
    keywords: ["vermifugo", "vermes", "comprimido", "oral", "remedio", "medicamentos"],
  },
  {
    id: "vitaminas-suplementos",
    title: "Vitaminas e Suplementos",
    category: "medicamentos",
    url: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=600&auto=format&fit=crop&q=80",
    keywords: ["vitamina", "suplemento", "pelo", "saude", "medicamentos"],
  },

  // Acessórios
  {
    id: "coleira-ajustavel",
    title: "Coleira Ajustável Refletiva",
    category: "acessorios",
    url: "https://images.unsplash.com/photo-1535294435445-d7249524ef2e?w=600&auto=format&fit=crop&q=80",
    keywords: ["coleira", "guia", "peitoral", "refletiva", "passeio", "acessorios"],
  },
  {
    id: "brinquedo-mordedor",
    title: "Brinquedo Mordedor Resistente",
    category: "acessorios",
    url: "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=600&auto=format&fit=crop&q=80",
    keywords: ["brinquedo", "mordedor", "corda", "bola", "borracha", "acessorios"],
  },
  {
    id: "arranhador-gatos",
    title: "Arranhador para Gatos",
    category: "acessorios",
    url: "https://images.unsplash.com/photo-1545249390-6bdfa286032f?w=600&auto=format&fit=crop&q=80",
    keywords: ["arranhador", "gato", "sisal", "torre", "poste", "acessorios"],
  },
  {
    id: "caminha-confortavel",
    title: "Cama Confortável para Pets",
    category: "acessorios",
    url: "https://images.unsplash.com/photo-1591946614720-90a587da4a36?w=600&auto=format&fit=crop&q=80",
    keywords: ["cama", "caminha", "almofada", "descanso", "acessorios"],
  },
  {
    id: "comedouro-inox",
    title: "Comedouro e Bebedouro Inox",
    category: "acessorios",
    url: "https://images.unsplash.com/photo-1601758228041-f3b2795255f1?w=600&auto=format&fit=crop&q=80",
    keywords: ["comedouro", "bebedouro", "tigela", "inox", "pote", "acessorios"],
  },
];

/**
 * Busca sugestões de imagens com base no nome do produto e categoria
 */
export function searchProductImages(searchTerm: string, category?: string): ProductImageItem[] {
  const q = searchTerm.trim().toLowerCase();
  const normalizedCategory = category?.toLowerCase();

  if (!q) {
    if (normalizedCategory && normalizedCategory !== "todos" && normalizedCategory !== "geral") {
      const byCat = CURATED_PRODUCT_IMAGES.filter((img) => img.category === normalizedCategory);
      return byCat.length > 0 ? byCat : CURATED_PRODUCT_IMAGES.slice(0, 8);
    }
    return CURATED_PRODUCT_IMAGES.slice(0, 8);
  }

  const terms = q.split(/\s+/).filter(Boolean);

  const scored = CURATED_PRODUCT_IMAGES.map((item) => {
    let score = 0;
    const titleLower = item.title.toLowerCase();

    for (const term of terms) {
      if (titleLower.includes(term)) score += 5;
      if (item.keywords.some((k) => k.includes(term) || term.includes(k))) score += 3;
    }

    if (normalizedCategory && item.category === normalizedCategory) {
      score += 2;
    }

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const results = scored.filter((s) => s.score > 0).map((s) => s.item);
  return results.length > 0 ? results : CURATED_PRODUCT_IMAGES.slice(0, 8);
}
