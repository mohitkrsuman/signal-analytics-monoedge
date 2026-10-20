---
name: react-only-when-needed
description: >-
  Chooses React hooks, memoization, higher-order components, and client state
  only when a concrete cost or spec requires them. Use when writing or
  reviewing React or Next.js UI, adding useMemo, useCallback, useEffect,
  useReducer, React.memo, HOCs, Redux, or any other client store, or when
  optimizing renders, charts, or forms in this app.
---

# React only when needed

Write the plain component first. Add a hook, a higher-order component, or a store only after naming the problem it solves. This app's screens read the Query API and Supabase Auth. They do not need Redux or higher-order components.

## This app

- Server Components load data and render pages. A Client Component exists only for a browser interaction: a form, a chart, a control.
- Readings, rollups, and alerts come from the Query API on each request or poll. Do not cache them in the client.
- Auth is the Supabase session cookie. Do not copy the user into a store.
- Shareable view state (selected signal, history range) belongs in the URL.
- Local UI state (`useState`) stays in the component that owns the control.
- Charts may poll every few seconds. That poll is not a reason to memoize the whole page.

Before writing UI, read the matching file in `specs/` and the Next.js guide in `node_modules/next/dist/docs/`.

## Hooks

| Hook | Add it only when |
| --- | --- |
| `useState` | The component owns UI state that render must show. |
| `useReducer` | Several updates to the same state must stay consistent, and separate `useState` calls would drift. |
| `useRef` | A value must survive renders without causing one: a timer id, a chart instance, a DOM node. |
| `useEffect` | Synchronizing with something outside React: a subscription, a timer, a browser API. Clean it up. |
| `useId` | A label needs a stable id. |
| `useTransition` / `useDeferredValue` | Typing or a control stays blocked behind an expensive render you have already seen. |
| `useMemo` | An expensive calculation reruns on parents that pass the same inputs, or the value is a dependency that would otherwise restart that work. |
| `useCallback` | A function is a dependency of a memoized child or an effect, and an inline function restarts that work. |
| `useLayoutEffect` | You must read or write layout before paint. Prefer `useEffect`. |
| `useImperativeHandle` | A parent must call an imperative method on a child that cannot be expressed as props. |

Do not use an effect to copy props into state or to compute a value render can derive.

Do not wrap a handler in `useCallback` when the only consumer is a DOM element (`button`, `input`, `div`).

Do not wrap a cheap expression in `useMemo` (a filter of a short list, a boolean, an object passed to one child that is not memoized).

`React.memo` is for a child that renders often with unchanged props and whose render is expensive, such as one chart among six. Do not memoize a page or a leaf that returns a few elements.

## Higher-order components

Do not add a higher-order component. Pass props, render `children`, or write a small wrapper component.

A higher-order component is allowed only when a third-party component cannot accept a hook and a wrapper component cannot do the same job. Name that constraint in a one-line comment.

## Redux and other stores

Do not add Redux, Redux Toolkit, Zustand, Jotai, or a React context that exists only to avoid prop drilling.

Add a client store only when all of these are true:

1. The same client state is needed across routes.
2. The URL cannot hold it.
3. The server cannot own it.
4. The spec names that state.

Until then, do not install a state library.

## Before adding an optimization

1. State the repeated work and which interaction causes it.
2. Prefer a Server Component, a narrower Client Component, or derived render state.
3. Add the hook or `React.memo` at the boundary that actually repeats.
4. Leave a one-line comment naming that boundary.
