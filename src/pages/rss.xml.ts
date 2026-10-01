import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import { SITE, HOME } from "@consts";

type Context = {
  site: string;
};

export async function GET(context: Context) {
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
  return rss({
    title: `${SITE.NAME} — ${HOME.DESCRIPTION}`,
    description: HOME.DESCRIPTION,
    site: context.site,
    trailingSlash: true,
    xmlns: { dc: "http://purl.org/dc/elements/1.1/" },
    customData: "<language>en</language>",
    items: items.map((item) => {
      const lang = item.collection === "blog" ? item.data.lang : "en";
      const tags = "tags" in item.data ? item.data.tags : undefined;
      return {
        title: item.data.title,
        description: item.data.description,
        pubDate: item.data.date,
        link: `/${item.collection}/${item.slug}/`,
        categories: tags,
        customData: `<dc:language>${lang}</dc:language>`,
      };
    }),
  });
}
