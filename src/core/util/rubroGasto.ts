// Nombre lindo de cada rubro de gasto de propiedad ("seguro_hogar" → "Seguro hogar").
export const RUBROS_GASTO: Record<string, string> = {
  expensas: "Expensas",
  ABL: "ABL",
  ARBA: "ARBA",
  luz: "Luz",
  gas: "Gas",
  agua: "Agua",
  internet: "Internet",
  seguro_hogar: "Seguro hogar",
  seguro_incendio: "Seguro incendio",
  reparacion: "Arreglo",
  otro: "Otro",
};

export const nombreRubro = (tipo: string) => RUBROS_GASTO[tipo] ?? tipo;
