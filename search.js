import axios from "axios";
import * as cheerio from "cheerio";

export async function searchDuck(query) {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;

  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  const $ = cheerio.load(data);
  const results = [];

  $(".result").each((i, el) => {
    const title = $(el).find(".result__title a").text();
    const link = $(el).find(".result__title a").attr("href");
    const snippet = $(el).find(".result__snippet").text();

    if (title && link) {
      results.push({ title, link, snippet });
    }
  });

  return results.slice(0, 3);
}