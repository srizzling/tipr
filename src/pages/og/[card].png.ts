import type { APIRoute, GetStaticPaths } from 'astro';
import { gameData } from '../../data';
import { allCards } from '../../lib/og-cards';
import { renderCardPng } from '../../lib/og-render';

// Cards are rendered once, at build time. Rasterising an image per request would blow the free Workers CPU limit.
export const getStaticPaths = (() => allCards(gameData).map(({ id, card }) => ({ params: { card: id }, props: { card } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const png = await renderCardPng(props.card);
  return new Response(png as BodyInit, { headers: { 'content-type': 'image/png' } });
};
