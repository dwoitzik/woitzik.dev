import rss from "@astrojs/rss";
import { getCollection, render } from "astro:content";
import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { check, renderToStaticMarkup } from "@astrojs/mdx/server.js";
import { SITE, HOME } from "@consts";

type Context = {
  site: string;
};

// A feed reader has no idea where "/" points. Relative hrefs and srcs resolve
// against the reader's own domain, so every internal link in the full text has
// to be absolutised before it leaves the build.
function absolutise(html: string, site: string) {
  return html
    .replace(/(href|src)="\/(?!\/)/g, `$1="${site}/`)
    .replace(/(href|src)="\/(?!\/)/g, `$1="${site}/`);
}

// Full text for the whole archive pushes the feed past 2 MB, and most readers
// silently drop or truncate an item they cannot finish parsing. Recent entries
// get the full body; everything older falls back to the description, which is
// the same content a reader saw before this change and keeps the feed small.
const FULL_TEXT_ITEMS = 20;

export async function GET(context: Context) {
  const site = new URL(context.site).origin;
  const blog = (await getCollection("blog")).filter((post) => !post.data.draft);

  const projects = (await getCollection("projects")).filter(
    (project) => !project.data.draft,
  );

  const items = [...blog, ...projects].sort(
    (a, b) => new Date(b.data.date).valueOf() - new Date(a.data.date).valueOf(),
  );

  // This feed mixes German and English posts, so the channel declares the
  // primary language and every item carries its own via dc:language. Without
  // the per-item tag a reader has no way to tell them apart, and German posts
  // end up in front of people who only read English.
  const feedUrl = new URL("rss.xml", context.site).href;

  // MDX compiles to a component tree, so full text means running the component
  // through a container. The MDX renderer has to be registered explicitly:
  // Astro does not add it to a container's renderer list on its own, and
  // without it every entry fails with NoMatchingRenderer.
  const container = await AstroContainer.create({
    renderers: [{ name: "@astrojs/mdx", ssr: { check, renderToStaticMarkup } }],
  });

  // lastBuildDate is the newest item date rather than the build time. A feed
  // that reports the build timestamp changes on every deploy even when nothing
  // was published, which teaches aggregators to re-fetch a feed that has not
  // changed and lets a stale entry keep its slot in a reader's timeline.
  const newest = items[0]?.data.date ?? new Date();

  return rss({
    title: `${SITE.NAME} — ${HOME.DESCRIPTION}`,
    description: HOME.DESCRIPTION,
    site: context.site,
    trailingSlash: true,
    xmlns: {
      dc: "http://purl.org/dc/elements/1.1/",
      atom: "http://www.w3.org/2005/Atom",
      content: "http://purl.org/rss/1.0/modules/content/",
    },
    customData: [
      // atom:link rel="self" tells a reader which of several endpoints is the
      // authoritative copy of this feed. Without it an aggregator that discovers
      // the feed through a <link> tag in a page head has to guess, and the
      // guess can put items into a different feed than the one they came from.
      `<atom:link href="${feedUrl}" rel="self" type="application/rss+xml"/>`,
      `<lastBuildDate>${new Date(newest).toUTCString()}</lastBuildDate>`,
      "<language>en</language>",
    ].join("\n"),
    items: await Promise.all(
      items.map(async (item, index) => {
        const lang = item.collection === "blog" ? item.data.lang : "en";
        const tags = "tags" in item.data ? item.data.tags : undefined;

        let encoded = "";
        if (index < FULL_TEXT_ITEMS) {
          const { Content } = await render(item);
          encoded = `<content:encoded>${absolutise(
            await container.renderToString(Content),
            site,
          )}</content:encoded>`;
        }

        return {
          title: item.data.title,
          description: item.data.description,
          pubDate: item.data.date,
          link: `/${item.collection}/${item.slug}/`,
          categories: tags,
          // content:encoded is the module readers actually look for; `content`
          // alone is dropped by most of them. The XML serialiser escapes the
          // markup on the way out, which is why no CDATA wrapper is needed —
          // and why a literal "]]>" in a post cannot break the document.
          customData: `<dc:language>${lang}</dc:language>` + encoded,
        };
      }),
    ),
  });
}
