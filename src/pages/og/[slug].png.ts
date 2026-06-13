import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import satori from "satori";
import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve } from "path";

export async function getStaticPaths() {
  const posts = await getCollection("blog");
  return posts
    .filter((p) => !p.data.draft)
    .map((post) => ({
      params: { slug: post.slug },
      props: { title: post.data.title, description: post.data.description },
    }));
}

export const GET: APIRoute = async ({ props }) => {
  const { title, description } = props as { title: string; description: string };

  const fontBold = readFileSync(resolve("public/fonts/atkinson-bold.woff"));
  const fontRegular = readFileSync(resolve("public/fonts/atkinson-regular.woff"));

  const svg = await satori(
    {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "60px 72px",
          backgroundColor: "#0c0c0c",
          fontFamily: "Atkinson",
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                width: "48px",
                height: "3px",
                backgroundColor: "#0ea5e9",
              },
              children: [],
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              },
              children: [
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "58px",
                      fontWeight: 700,
                      color: "#ffffff",
                      lineHeight: 1.15,
                      letterSpacing: "-0.02em",
                    },
                    children: title,
                  },
                },
                {
                  type: "div",
                  props: {
                    style: {
                      fontSize: "24px",
                      fontWeight: 400,
                      color: "#737373",
                      lineHeight: 1.5,
                    },
                    children: description,
                  },
                },
              ],
            },
          },
          {
            type: "div",
            props: {
              style: {
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              },
              children: [
                {
                  type: "span",
                  props: {
                    style: {
                      fontSize: "16px",
                      color: "#404040",
                      fontWeight: 400,
                      letterSpacing: "0.08em",
                    },
                    children: "TERRAFORM · AZURE · ZERO-TRUST",
                  },
                },
                {
                  type: "span",
                  props: {
                    style: {
                      fontSize: "20px",
                      color: "#525252",
                      fontWeight: 400,
                    },
                    children: "woitzik.dev",
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: "Atkinson", data: fontBold, weight: 700, style: "normal" },
        { name: "Atkinson", data: fontRegular, weight: 400, style: "normal" },
      ],
    }
  );

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png" },
  });
};
