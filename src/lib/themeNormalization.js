export const normalizeThemeLeadersItems = (items) => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item, index) => {
    const safeItem = item && typeof item === "object" ? { ...item } : {};
    const normalizedCode =
      typeof safeItem.themeCode === "string" ? safeItem.themeCode.trim() : "";
    const normalizedName =
      typeof safeItem.name === "string" ? safeItem.name.trim() : "";
    const themeName = normalizedName || "theme";

    return {
      ...safeItem,
      themeCode: normalizedCode || safeItem.themeCode || "",
      id: normalizedCode || `${themeName}-${index}`,
      leaders: Array.isArray(safeItem.leaders) ? safeItem.leaders : [],
    };
  });
};
