module.exports = {
  plugins: [
    require.resolve("@trivago/prettier-plugin-sort-imports"),
    require.resolve("prettier-plugin-packagejson"),
  ],
  // @see https://github.com/trivago/prettier-plugin-sort-imports
  importOrder: ["<THIRD_PARTY_MODULES>", "^[./]"],
  overrides: [
    {
      files: "*.svg",
      options: {
        parser: "html",
      },
    },
  ],
};
