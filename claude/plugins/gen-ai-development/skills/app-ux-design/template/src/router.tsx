// TanStack Router setup. Adding a screen = adding a route here + a new
// directory under src/screens/. The router uses code-based config so the
// agent can edit it directly.
//
// To add a screen:
//   1. Create src/screens/<id>/index.tsx with a default export.
//   2. Import it below and create a new createRoute({ path: "/<id>", ... }).
//   3. Add it to rootRoute.addChildren([...]).
//   4. Append to .ued/screens.json so /__ued/shell picks it up in the switcher.

import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
} from "@tanstack/react-router";
import HomeScreen from "@/screens/home";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeScreen,
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  // ↑ Add more routes here as you add screens.
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
