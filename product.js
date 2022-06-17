import customExporter from "./customExporter.js";
import fs from "fs";
import fse from "fs-extra";
import dotenv from "dotenv";
import path from "path";
import zip from "node-zip";

import { sendtoalgolia } from "./pushToAlgolia.js";
dotenv.config();

var startBatching = new Date(),
  endBatching,
  startConvertion,
  endConvertion,
  endSync;
const apiConfig = {
  apiUrl: process.env.CT_API_URL,
  host: process.env.CT_HOST,
  authUrl: process.env.CT_AUTH_URL,
  projectKey: process.env.CT_PROJECT_KEY,
  credentials: {
    clientId: process.env.CT_CLIENT_ID,
    clientSecret: process.env.CT_CLIENT_SECRECT,
  },
};
const exportConfig = {
  batch: parseInt(process.env.PRODUCTS_PER_BATCH),
  json: true,
  staged: true,
  expand: [process.env.PRODUCT_ATTRIBUTES],
};
const logger = {
  error: console.error,
  warn: console.warn,
  info: console.log,
  debug: console.debug,
};

const accessToken = process.env.CT_ACCESS_TOKEN;

const CcustomExporter = new customExporter(
  apiConfig,
  exportConfig,
  logger,
  accessToken
);
var outputStream = fs.createWriteStream("products.txt");

// // Register error listener
outputStream.on("error", function (v) {
  console.log(v);
});

fse.emptyDirSync("./data");

outputStream.on("finish", function (v) {
  endBatching = new Date() - startBatching;

  console.log("Batch files saved total time taken : %ds", endBatching / 1000);
  console.log("-----------------------------------------");
  let ziper = new zip();
  const jsonsInDir = fs
    .readdirSync("./data")
    .filter((file) => path.extname(file) === ".json");
  const categories = JSON.parse(fs.readFileSync("categories.json"));
  jsonsInDir.forEach((file) => {
    startConvertion = Date();
    let finalproducts = [];

    try {
      const fileData = fs.readFileSync(path.join("./data", file));
      if (fileData) {
        const products = JSON.parse(fileData.toString());
        for (let product of products) {
          product.variants.push(product.masterVariant);
          let sizes = [];
          let colors = [];
          let varients = [];
          let types = [];
          for (let variant of product.variants) {
            for (let attr of variant.attributes) {
              if (attr.name.includes("_")) {
                let header = attr.name.split("_");
                if (header.length > 0) {
                  if (types.indexOf(header[0]) == -1) types.push(header[0]);
                  if (header[1] == "size")
                    if (sizes.indexOf(attr.value.key) == -1)
                      sizes.push(attr.value.key);
                  if (header[1] == "color")
                    if (colors.indexOf(attr.value.label.en) == -1) {
                      // console.log(attr.value.label.en);
                      colors.push(attr.value.label.en);
                      varients.push({
                        color: attr.value.label.en,
                        url: variant.images[0].url,
                        sku: variant.sku,
                        price: variant.prices[0].value.centAmount,
                      });
                    }
                }
              }
            }
          }
          for (let color of colors) {
            for (let size of sizes) {
              let resultData = {
                type: types[0],
                model: product.name.en,
                color: color,
                size: size,
                thumbnail_url: varients.filter((x) => x.color == color)[0].url,
                color_variants: colors.filter((x) => x != color),
                size_variants: sizes.filter((x) => x != size),
                sku: varients.filter((x) => x.color == color)[0].sku,
                price: varients.filter((x) => x.color == color)[0].price,
                slug: product.slug.en,
              };

              finalproducts.push(resultData);
            }
          }
        }
        if (finalproducts.length > 0) {
          sendtoalgolia(
            startBatching,
            endBatching,
            endSync,
            "finalproducts",
            "finalproducts.json",
            finalproducts,
            process.env.ALGOLIA_PRODUCTS_INDEX_NAME
          );
          // fs.writeFile('finalcategories.json', JSON.stringify(finalcategories), 'utf8', function(err) {
          //     if (err) {
          //         return console.log(err);
          //     }
          // });
        }
      }
    } catch (err) {
      console.log("file empty or undefined");
      // continue;
    }
  });
  var data = ziper.generate({ base64: false, compression: "DEFLATE" });

  try {
    if (!fs.existsSync("./archive")) {
      fs.mkdirSync("./archive");
    }
  } catch (err) {
    console.error(err);
  }
  fs.writeFileSync(
    "./archive/file_" + process.env.CT_PROJECT_KEY + ".zip",
    data,
    "binary"
  );
  try {
    fs.unlinkSync("./categories.txt");
    fs.unlinkSync("./products.txt");
  } catch (err) {}
});
console.log("Product Indexer Executing ..." + "\n");
console.time("Product Indexer code execution time:");
CcustomExporter.run(outputStream);

console.timeEnd("Product Indexer code execution time:");
