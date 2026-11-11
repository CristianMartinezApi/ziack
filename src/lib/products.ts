export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  compareAt?: number;
  tag?: string;
  tone: "pearl" | "gold" | "rose" | "onyx";
  description: string;
  imageUrl?: string | null;
};

export const products: Product[] = [
  { id: "1", slug: "brinco-aurora", name: "Brinco Aurora", category: "Brincos", price: 289, stock: 12, compareAt: 359, tag: "Mais amado", tone: "pearl", description: "Uma forma delicada de iluminar os dias. Banhado a ouro 18k com pérola de água doce." },
  { id: "2", slug: "colar-luna", name: "Colar Luna", category: "Colares", price: 420, stock: 12, tag: "Novo", tone: "gold", description: "Uma corrente delicada com pingente orgânico, feito para acompanhar você em todos os momentos." },
  { id: "3", slug: "anel-solar", name: "Anel Solar", category: "Anéis", price: 349, stock: 12, tone: "rose", description: "Design escultural e acabamento polido. Uma peça que transforma o essencial em extraordinário." },
  { id: "4", slug: "pulseira-essencia", name: "Pulseira Essência", category: "Pulseiras", price: 315, stock: 12, tone: "onyx", description: "Elegância sem esforço em uma pulseira ajustável, com banho premium de ouro 18k." },
];

export const categories = ["Todos", "Colares", "Brincos", "Anéis", "Pulseiras"];

export const formatPrice = (price: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price);
