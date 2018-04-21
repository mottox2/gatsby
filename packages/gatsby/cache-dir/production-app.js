import { apiRunner, apiRunnerAsync } from "./api-runner-browser"
import React, { createElement } from "react"
import ReactDOM from "react-dom"
import { Router, Route, withRouter, matchPath } from "react-router-dom"
import { ScrollContext } from "gatsby-react-router-scroll"
import domReady from "domready"
import { createLocation } from "history"
import history from "./history"
window.___history = history
import emitter from "./emitter"
window.___emitter = emitter
import pages from "./pages.json"
import redirects from "./redirects.json"
import ComponentRenderer from "./component-renderer"
import asyncRequires from "./async-requires"
import loader from "./loader"
loader.addPagesArray(pages)
loader.addProdRequires(asyncRequires)

window.asyncRequires = asyncRequires
window.___emitter = emitter
window.___loader = loader

window.matchPath = matchPath

loader.addPagesArray(pages)
loader.addProdRequires(asyncRequires)

// Convert to a map for faster lookup in maybeRedirect()
const redirectMap = redirects.reduce((map, redirect) => {
  map[redirect.fromPath] = redirect
  return map
}, {})

const maybeRedirect = pathname => {
  const redirect = redirectMap[pathname]

  if (redirect != null) {
    history.replace(redirect.toPath)
    return true
  } else {
    return false
  }
}

// Check for initial page-load redirect
maybeRedirect(window.location.pathname)

// Let the site/plugins run code very early.
apiRunnerAsync(`onClientEntry`).then(() => {
  // Let plugins register a service worker. The plugin just needs
  // to return true.
  if (apiRunner(`registerServiceWorker`).length > 0) {
    require(`./register-service-worker`)
  }

  const navigateTo = to => {
    const location = createLocation(to, null, null, history.location)
    let { pathname } = location
    const redirect = redirectMap[pathname]

    // If we're redirecting, just replace the passed in pathname
    // to the one we want to redirect to.
    if (redirect) {
      pathname = redirect.toPath
    }
    const wl = window.location

    // If we're already at this location, do nothing.
    if (
      wl.pathname === location.pathname &&
      wl.search === location.search &&
      wl.hash === location.hash
    ) {
      return
    }

    // Listen to loading events. If page resources load before
    // a second, navigate immediately.
    function eventHandler(e) {
      if (e.page.path === loader.getPage(pathname).path) {
        emitter.off(`onPostLoadPageResources`, eventHandler)
        clearTimeout(timeoutId)
        window.___history.push(location)
      }
    }

    // Start a timer to wait for a second before transitioning and showing a
    // loader in case resources aren't around yet.
    const timeoutId = setTimeout(() => {
      emitter.off(`onPostLoadPageResources`, eventHandler)
      emitter.emit(`onDelayedLoadPageResources`, { pathname })
      window.___history.push(location)
    }, 1000)

    if (loader.getResourcesForPathname(pathname)) {
      // The resources are already loaded so off we go.
      clearTimeout(timeoutId)
      window.___history.push(location)
    } else {
      // They're not loaded yet so let's add a listener for when
      // they finish loading.
      emitter.on(`onPostLoadPageResources`, eventHandler)
    }
  }

  // window.___loadScriptsForPath = loadScriptsForPath
  window.___navigateTo = navigateTo

  // Call onRouteUpdate on the initial page load.
  apiRunner(`onRouteUpdate`, {
    location: history.location,
    action: history.action,
  })

  let initialAttachDone = false
  function attachToHistory(history) {
    if (!window.___history || initialAttachDone === false) {
      window.___history = history
      initialAttachDone = true

      history.listen((location, action) => {
        if (!maybeRedirect(location.pathname)) {
          // Make sure React has had a chance to flush to DOM first.
          setTimeout(() => {
            apiRunner(`onRouteUpdate`, { location, action })
          }, 0)
        }
      })
    }
  }

  function shouldUpdateScroll(prevRouterProps, { location: { pathname } }) {
    const results = apiRunner(`shouldUpdateScroll`, {
      prevRouterProps,
      pathname,
    })
    if (results.length > 0) {
      return results[0]
    }

    if (prevRouterProps) {
      const { location: { pathname: oldPathname } } = prevRouterProps
      if (oldPathname === pathname) {
        return false
      }
    }
    return true
  }

  const AltRouter = apiRunner(`replaceRouterComponent`, { history })[0]

  const ComponentRendererWithRouter = withRouter(ComponentRenderer)

  loader.getResourcesForPathname(window.location.pathname, () => {
    let pathPrefix = `/`
    if (__PREFIX_PATHS__) {
      pathPrefix = `${__PATH_PREFIX__}/`
    }

    const Root = () =>
      createElement(
        AltRouter ? AltRouter : Router,
        {
          basename: pathPrefix.slice(0, -1),
          history: !AltRouter ? history : undefined,
        },
        createElement(
          ScrollContext,
          { shouldUpdateScroll },
          createElement(withRouter(Route), {
            render: routeProps => {
              attachToHistory(routeProps.history)

              if (loader.getPage(routeProps.location.pathname)) {
                return createElement(ComponentRenderer, {
                  isPage: true,
                  ...routeProps,
                })
              } else {
                return createElement(ComponentRenderer, {
                  isPage: true,
                  location: { pathname: `/404.html` },
                })
              }
            },
          })
        )
      )

    const NewRoot = apiRunner(`wrapRootComponent`, { Root }, Root)[0]
    domReady(() => {
      ReactDOM.hydrate(
        <NewRoot />,
        typeof window !== `undefined`
          ? document.getElementById(`___gatsby`)
          : void 0,
        () => {
          apiRunner(`onInitialClientRender`)
        }
      )
    })
  })
})
