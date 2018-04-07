module.exports = {
  program: require(`./program`),
  nodes: require(`./nodes`),
  nodesTouched: require(`./nodes-touched`),
  lastAction: require(`./last-action`),
  plugins: require(`./plugins`),
  flattenedPlugins: require(`./flattened-plugins`),
  apiToPlugins: require(`./api-to-plugins`),
  config: require(`./config`),
  pages: require(`./pages`),
  schema: require(`./schema`),
  status: require(`./status`),
  componentDataDependencies: require(`./component-data-dependencies`),
  components: require(`./components`),
  jobs: require(`./jobs`),
  webpack: require(`./webpack`),
  redirects: require(`./redirects`),
  babelrc: require(`./babelrc`),
  jsonDataPaths: require(`./json-data-paths`),
}
