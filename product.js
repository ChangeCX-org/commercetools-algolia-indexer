import customExporter from './customExporter.js';
import fs from 'fs';
import fse from 'fs-extra'
import dotenv from "dotenv";
import path from 'path';
import zip from 'node-zip';

import { sendtoalgolia } from './pushToAlgolia.js'
dotenv.config();

var startBatching = new Date(),
    endBatching, startConvertion, endConvertion, endSync;
const apiConfig = {
    apiUrl: process.env.CT_API_URL,
    host: process.env.CT_HOST,
    authUrl: process.env.CT_AUTH_URL,
    projectKey: process.env.CT_PROJECT_KEY,
    credentials: {
        clientId: process.env.CT_CLIENT_ID,
        clientSecret: process.env.CT_CLIENT_SECRECT,
    }
}
const exportConfig = {
    batch: parseInt(process.env.PRODUCTS_PER_BATCH),
    json: true,
    staged: true,
    expand: [process.env.PRODUCT_ATTRIBUTES],


}
const logger = {
    error: console.error,
    warn: console.warn,
    info: console.log,
    debug: console.debug,
}

const accessToken = process.env.CT_ACCESS_TOKEN;

const CcustomExporter = new customExporter(
    apiConfig,
    exportConfig,
    logger,
    accessToken,
)
var outputStream = fs.createWriteStream('products.txt');

// // Register error listener
outputStream.on('error', function(v) {
    console.log(v);
})

fse.emptyDirSync('./data');

// Array.prototype.forEachAsync = async function (fn) {
//     for (let t of this) { await fn(t) }
// }
outputStream.on('finish', function(v) {
    endBatching = new Date() - startBatching;

    console.log("Batch files saved total time taken : %ds", endBatching / 1000);
    console.log('-----------------------------------------');
    let ziper = new zip();
    const jsonsInDir = fs.readdirSync('./data').filter(file => path.extname(file) === '.json');
    const categories = JSON.parse(fs.readFileSync('categories.json'));
    jsonsInDir.forEach(file => {
        startConvertion = Date();
        let finalproducts = [];
        try {
            const fileData = fs.readFileSync(path.join('./data', file));
            //if (fileData) {
            const products = JSON.parse(fileData.toString());
           
            let env_languages = (process.env.LANGUAGES).split(',');
            let fproducts = [];
            let env_attributes = (process.env.VARIENT_ATTRIBUTES).split(',');
            for (let product of products) {
                let k = product.categories.length;
                if (k != 0) {
                    let parent_cat = categories.filter(x => x.id == product.categories[(k != 0 ? k - 1 : k)].id)[0];
                    product.categories.push(parent_cat.parent);
                }
            }

            for (let product of products) {
                product.alter_categories = {};
                product.hierarchicalCategories = {};
                for (let lan of env_languages) {
                    product.alter_categories[lan] = [];
                    product.hierarchicalCategories[lan] = [];
                }

                product.variants.push(product.masterVariant);
                let inc = 0;
                if (product.variants) {
                    for (let variant of product.variants) {
                        if (variant.prices) {
                            for (let price of variant.prices) {
                                if (price.value.currencyCode == "USD")
                                    product.variants[inc].price = price.value;
                            }
                        }

                        for (let attr of env_attributes) {
                            product[attr] = [];
                        }

                        for (let attribute of variant.attributes) {
                            if (env_attributes.includes(attribute.name)) {
                                product.variants[inc][attribute.name] = attribute.value.key || attribute.value;
                                //console.log(env_attributes,attribute)
                                if (!product[attribute.name].includes(attribute.value.key || attribute.value))
                                    product[attribute.name].push(attribute.value.key || attribute.value);
                            }
                        }
                        inc++;
                    }
                    product.variants.sort((a, b) => a.id - b.id);
                }

                let j = 0;
                let k = product.categories.length;

                for (let cat of product.categories) {
                    if (cat) {
                        let cat_data = categories.filter(x => x.id == cat.id)[0];
                        for (let lan of env_languages) {
                            product.alter_categories[lan].push({ slug: cat_data.categories[lan].slug });
                            product.hierarchicalCategories[lan].push(cat_data.hierarchicalCategories[lan]);
                        }
                    }
                }
                fproducts.push(product);

            }

            for (let product of fproducts) {
                for (let variant of product.variants) {
                    let resultdata = {
                        objectID: variant.sku,
                        parentId: product.id,
                        name: product.name,
                        description: product.description,
                        slug: product.slug,
                        sku: variant.sku,
                        categories: product.alter_categories,
                        hierarchicalCategories: product.hierarchicalCategories,
                        price: variant.price,
                        images: variant.images,
                    };
                    for (let attr of env_attributes) {
                        resultdata[attr] = variant[attr];
                    }
                    finalproducts.push(resultdata);
                    //sendtoalgolia(startBatching, endBatching, endSync, 'Product', file, finalproducts, process.env.ALGOLIA_PRODUCTS_INDEX_NAME);
                    //finalproducts = [];
                }

            }
            if (finalproducts.length) {
                endConvertion = new Date() - startConvertion;

                sendtoalgolia(startBatching, endBatching, endSync, 'Product', file, finalproducts, process.env.ALGOLIA_PRODUCTS_INDEX_NAME);
                finalproducts = []
                ziper.file(file, fs.readFileSync(path.join('./data', file)));
            }
            //}
        } catch (err) {
            console.log("file empty or undefined");
            // continue;
        }


    });
    var data = ziper.generate({ base64: false, compression: 'DEFLATE' });

    try {
        if (!fs.existsSync("./archive")) {
            fs.mkdirSync('./archive')
        }
    } catch (err) {
        console.error(err)
    }
    fs.writeFileSync('./archive/file_' + process.env.CT_PROJECT_KEY + '.zip', data, 'binary');
    try {
        fs.unlinkSync('./categories.txt');
        fs.unlinkSync('./products.txt');
    } catch (err) {}
})
console.log("Product Indexer Executing ..." + '\n')
console.time('Product Indexer code execution time:');
CcustomExporter.run(outputStream);

console.timeEnd('Product Indexer code execution time:');