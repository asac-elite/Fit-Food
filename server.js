"use strict";

// -------------------------------- DECLARE VARIABLES --------------------------------
const express = require("express");
const cors = require("cors");
require("dotenv").config(".env");
const expressLayouts = require("express-ejs-layouts");
const pg = require("pg");
const methodOverride = require('method-override');
const client = new pg.Client(process.env.DATABASE_URL);



// initialize the server
const app = express();

// Declare a port
const PORT = process.env.PORT || 3000;

// Declare a app id for edmam
const APP_ID = process.env.APP_ID;
// Declare a app id for edmam
const APP_KEY = process.env.APP_KEY;
// Declare a app id for edmam
const APP_ID_NUT = process.env.APP_ID_NUT;
// Declare a app id for edmam
const APP_KEY_NUT = process.env.APP_KEY_NUT;

// using layouts
app.use(expressLayouts);

// Use cros
app.use(cors());

// Use super agent
const superagent = require("superagent");


// view engine setup
app.set("view engine", "ejs");

//setup public folder
app.use(express.static("public"));

//set the encode for post body request
app.use(express.urlencoded({ extended: true }));

// override http methods
app.use(methodOverride("_method"));

//set database and connect to the server
client.connect().then(() => {
  app.listen(PORT, () => {
    console.log("I am listening to port: ", PORT);
  });
})

// -------------------------------- ROUTES --------------------------------

// Home route
app.get("/", homeHandler);

// get search
app.get("/search", searchHandler);

// add meal to fav
app.post("/addFav", addFav);

// Fav route
app.get("/fav", favHandler);

// delete recipe from fav
app.delete("/recipe/:id" , deleteFav);

// get calculator
app.get("/calculate", calculateCalories);

// get ingredients
app.get("/ingredientDetails", renderIngredients);

// post ingredients
app.post("/ingredientDetails", renderIngredients);

// get recipe by uri
app.get("/recipeDetails/", recipeDetailsHandler);

// all other routes
// app.get("*", errorHandler);

// -------------------------------- CALLBACK FUNCTIONS --------------------------------

//home
function homeHandler(req, res) {
  res.render("index");
}

//search
async function searchHandler(req, res) {
  let ingredients = req.query.searchFood;
  let from = req.query.from;
  let to = req.query.to;
  let diet = req.query.diet;
  let health = req.query.health;
  let recipes = await getRecipes(ingredients, from, to, diet, health);
  res.render("pages/recipeResult", {
    recipes: recipes,
  });
}

//fav
async function favHandler(req, res) {

  let result = await getRecipeDB();
  res.render("pages/fav", { meals: result.meals });
}

async function addFav(req, res) {
  let recipeInfo = req.body;
  recipeInfo.ingredients = recipeInfo.ingredients.split(",");
  let dateNow = new Date();
  let localDate = dateNow.toLocaleDateString();
  recipeInfo.data = localDate;
  let result = await saveRecipeDB(recipeInfo);
}

async function deleteFav(req, res) {
  const recipeId = req.params.id;
  let result = await deleteRecipeDB(recipeId);
  res.redirect('/fav');

}


//calculate
function calculateCalories(req, res) {
  res.render("pages/calorieCalculator");
}
// render result 
async function renderIngredients(req, res) {
  let length = Math.floor(Object.keys(req.body).length/3) - 1;
  let nutritionArray = [];
  let maxCalories = req.body.maxCalories;

  for (var key in TotalIngredients) {
    TotalIngredients[key][0] = 0;
    TotalIngredients[key][1] = 0;
  };

  for (var i = 0; i <= length; i++) {
    let stringName = 'searchIngredient' + i;
    let stringAmount = 'ingredientAmount' + i;
    let stringMeasure = 'ingredientMeasure' + i;
    let allString = req.body[stringName] + ' ' + req.body[stringAmount] + ' ' + req.body[stringMeasure];
    let ingredient = await getNutrition(allString);


    // addNutrition = ();
    nutritionArray.push(ingredient);
    
  }
  console.log(nutritionArray);
  nutritionArray.forEach(ingredient => {                    // sums all nutrients
    for (var key in ingredient.nutrients) {
      TotalIngredients[key][0] += parseInt(ingredient.nutrients[key][0]);
      TotalIngredients[key][1] += parseInt(ingredient.nutrients[key][1]);
    };
  });
  res.render('pages/nutritionDetail', {
    maxCalories: maxCalories,
    nutritionArray: nutritionArray,
    TotalIngredients: TotalIngredients
  });

}
//recipe details
async function recipeDetailsHandler(req, res) {
  let uri = req.query.uri;
  let recipe = await getRecipeByURI(uri);
  res.render('pages/recipeDetail', {recipe: recipe});
}

// -------------------------------- API FUNCTIONS --------------------------------

//search recipe API
function getRecipes(ingredients, from, to, diet, health) {
  let url = "https://api.edamam.com/search";
  let queryParams = {
    q: ingredients,
    app_id: APP_ID,
    app_key: APP_KEY,
    calories:
      from && to ? `${from}-${to}` : from ? `${from}+` : to ? `${to}` : "0+",
    diet: diet,
    health: health,
  };
  let result = superagent
    .get(url)
    .query(queryParams)
    .then((res) => {
      return res.body.hits.map((e) => {
        return new Recipe(e);
      });
    })
    .catch((error) => {
      return {
        status: error.status,
        message: error.response.text,
      };
    });
  return result;
}

//search nutrition API
function getNutrition(string) {
  let url = "https://api.edamam.com/api/nutrition-data";
  let queryParams = {
    app_id: APP_ID_NUT,
    app_key: APP_KEY_NUT,
    ingr: string
  };
  let result = superagent
    .get(url)
    .query(queryParams)
    .then((res) => {
      console.log(res.body);
      return new Ingredient(res.body);
    });
    console.log(result);
  return result;
}

// get recipe by it's uri
function getRecipeByURI(uri) {
  let url = "https://api.edamam.com/search";
  let queryParams = {
    r: uri,
    app_id: APP_ID,
    app_key: APP_KEY,
  };
  console.log(queryParams);
  let result = superagent
    .get(url)
    .query(queryParams)
    .then((res) => {
      return new Recipe({ recipe: res.body[0] });
    })
    .catch((error) => {
      console.log(error);
    });
  return result;
}

// -------------------------------- DATA FUNCTIONS --------------------------------

// save recipe into database
function saveRecipeDB(recipeInfo) {
  let SQL =
    "INSERT INTO recipes (title,totalCalories,ingredients,uri,servings,instructions_url,calPerServ,image,date ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id";
  let recipeArray = [
    recipeInfo.title,
    recipeInfo.totalCalories,
    recipeInfo.ingredients,
    recipeInfo.uri,
    recipeInfo.servings,
    recipeInfo.instructions_url,
    recipeInfo.calPerServ,
    recipeInfo.image,
    recipeInfo.data,
  ];
  return client.query(SQL, recipeArray).then((result) => {
    console.log(result);
    // return result.rows;
  });
}

// Get recipe from database
function getRecipeDB() {
  let SQL = "SELECT * FROM recipes";
  return client.query(SQL).then((result) => {
    return { meals: result.rows };
  });
}
// https://api.edamam.com/api/nutrition-data?app_id=14955312&
// app_key=b051ae90212f813de4b95da243ad9e8a&ingr=10%20apple 
///----- 1 ingredient at a time with measuring 1cups%20apple

// https://api.edamam.com/search?q=chicken&excluded=citrus&excluded=salt
// &excluded=kosher%20salt&app_id=a49852e9&app_key=1d096000e385b476818f554e3b06870d&
// from=0&to=3&calories=591-722&health=alcohol-free 
///----- Excluded concatenated multiple times

 // delete recipe from database
function deleteRecipeDB(recipeId){
  let SQL = `DELETE FROM recipes WHERE id=${recipeId}`;
  return client.query(SQL).then(result => {
    return { meals: result.rows };
});
}


// -------------------------------- CONSTRUCTORS --------------------------------
function Recipe(data) {
  this.uri = encodeURIComponent(data.recipe.uri);
  this.title = data.recipe.label;
  this.image = data.recipe.image;
  this.ingredients = data.recipe.ingredientLines;
  this.totalCalories = Math.round(data.recipe.calories);
  this.servings = data.recipe.yield;
  this.instructions_url = data.recipe.url;
  this.calPerServ = Math.round(this.totalCalories / this.servings);
}

function Ingredient(data) {
  this.uri = encodeURIComponent(data.uri);
  this.title = data.ingredients[0].parsed[0].food;
  this.quantity = data.ingredients[0].parsed[0].quantity;
  this.measure = data.ingredients[0].parsed[0].measure;
  this.totalCalories = Math.round(data.calories);
  this.weight = data.ingredients[0].parsed[0].weight;
  this.id = data.ingredients[0].parsed[0].foodId;
  this.nutrients = {
    'Total Fat': [data.totalNutrients.FAT.quantity.toFixed(1) || 0, data.totalDaily.FAT.quantity.toFixed(1) || 0, data.totalNutrients.FAT.unit],
    'Saturated Fat': [data.totalNutrients.FASAT.quantity.toFixed(1) || 0, data.totalDaily.FASAT.quantity.toFixed(1) || 0, data.totalNutrients.FASAT.unit],
    'Trans Fat': [(data.totalNutrients.FAMS.quantity + data.totalNutrients.FAPU.quantity).toFixed(1) || 0, 0, data.totalNutrients.FAPU.unit],
    Cholesterol: [data.totalNutrients.CHOLE.quantity.toFixed(1) || 0, data.totalDaily.CHOLE.quantity.toFixed(1) || 0, data.totalNutrients.CHOLE.unit],
    Sodium: [data.totalNutrients.NA.quantity.toFixed(1) || 0, data.totalDaily.NA.quantity.toFixed(1) || 0, data.totalNutrients.NA.unit],
    Carbohydrate: [data.totalNutrients.CHOCDF.quantity.toFixed(1) || 0, data.totalDaily.CHOCDF.quantity.toFixed(1) || 0, data.totalNutrients.CHOCDF.unit],
    'Dietary Fiber': [data.totalNutrients.FIBTG.quantity.toFixed(1) || 0, data.totalDaily.FIBTG.quantity.toFixed(1) || 0, data.totalNutrients.FIBTG.unit],
    'Total Sugars': [data.totalNutrients.SUGAR.quantity.toFixed(1) || 0, 0, data.totalNutrients.SUGAR.unit],
    Protein: [data.totalNutrients.PROCNT.quantity.toFixed(1) || 0, data.totalDaily.PROCNT.quantity.toFixed(1) || 0, data.totalNutrients.PROCNT.unit],
    'Vitamin A': [data.totalNutrients.VITA_RAE.quantity.toFixed(1) || 0, data.totalDaily.VITA_RAE.quantity.toFixed(1) || 0, data.totalNutrients.VITA_RAE.unit],
    'Vitamin C': [data.totalNutrients.VITC.quantity.toFixed(1) || 0, data.totalDaily.VITC.quantity.toFixed(1) || 0, data.totalNutrients.VITC.unit],
    'Vitamin D': [data.totalNutrients.VITD.quantity.toFixed(1) || 0, data.totalDaily.VITD.quantity.toFixed(1) || 0, data.totalNutrients.VITD.unit],
    Calcium: [data.totalNutrients.CA.quantity.toFixed(1) || 0, data.totalDaily.CA.quantity.toFixed(1) || 0, data.totalNutrients.CA.unit],
    Iron: [data.totalNutrients.FE.quantity.toFixed(1) || 0, data.totalDaily.FE.quantity.toFixed(1) || 0, data.totalNutrients.FE.unit],
    Potassium: [data.totalNutrients.K.quantity.toFixed(1) || 0, data.totalDaily.K.quantity.toFixed(1) || 0, data.totalNutrients.K.unit],
  }
}

let TotalIngredients = {
  'Total Fat' : [0,0],
  'Saturated Fat' : [0,0],
  'Trans Fat' : [0,0],
  Cholesterol : [0,0],
  Sodium : [0,0],
  Carbohydrate : [0,0],
  'Dietary Fiber' : [0,0],
  'Total Sugars' : [0,0],
  Protein : [0,0],
  'Vitamin A' : [0,0],
  'Vitamin C' : [0,0],
  'Vitamin D' : [0,0],
  Calcium : [0,0],
  Iron : [0,0],
  Potassium : [0,0],
}
