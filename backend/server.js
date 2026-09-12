const express = require("express");
const cors = require("cors");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const sql = require("./db");

const app = express();


// ======================================================
// CONFIG
// ======================================================

const PORT = process.env.PORT || 5000;

const allowedOrigin =
    process.env.FRONTEND_URL || "http://localhost:5173";


// ======================================================
// SUPABASE AUTH CLIENT
// ======================================================

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);


// ======================================================
// MIDDLEWARE
// ======================================================

app.use(
    cors({
        origin: allowedOrigin
    })
);

app.use(express.json());


// ======================================================
// AUTHENTICATION MIDDLEWARE
// ======================================================

async function requireAuth(req, res, next) {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                message: "Authentication required"
            });
        }

        const token = authHeader.substring(7);

        const {
            data: { user },
            error
        } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({
                message: "Invalid or expired session"
            });
        }

        // Trusted user identity
        req.user = user;

        next();

    } catch (error) {

        console.error("Authentication error:", error);

        return res.status(401).json({
            message: "Authentication failed"
        });
    }
}


// ======================================================
// HEALTH CHECK
// ======================================================

app.get("/", (req, res) => {

    res.json({
        message: "Life RPG API is running!"
    });

});


// ======================================================
// CHARACTER
// ======================================================

app.get("/character", requireAuth, async (req, res) => {

    try {

        const userId = req.user.id;

        const result = await sql`
            SELECT
                id,
                user_id,
                xp,
                level,
                coins,
                streak,
                strength,
                intellect,
                discipline,
                creativity,
                last_completed_date
            FROM public.characters
            WHERE user_id = ${userId}
        `;

        if (result.length === 0) {

            return res.status(404).json({
                message: "Character not found"
            });

        }

        res.json(result[0]);

    } catch (error) {

        console.error("Character error:", error);

        res.status(500).json({
            message: "Failed to fetch character"
        });

    }

});


// ======================================================
// CREATE QUEST
// ======================================================

app.post("/tasks", requireAuth, async (req, res) => {

    try {

        const userId = req.user.id;

        const {
            title,
            description,
            category,
            difficulty,
            attribute
        } = req.body;


        // ----------------------------------------------
        // VALIDATION
        // ----------------------------------------------

        if (
            typeof title !== "string" ||
            title.trim().length === 0 ||
            title.length > 120
        ) {

            return res.status(400).json({
                message: "Quest title is required and must be under 120 characters"
            });

        }


        const cleanDifficulty = Number(difficulty);

        if (![1, 2, 3].includes(cleanDifficulty)) {

            return res.status(400).json({
                message: "Difficulty must be 1, 2, or 3"
            });

        }


        const allowedAttributes = [
            "strength",
            "intellect",
            "discipline",
            "creativity"
        ];

        if (
            attribute &&
            !allowedAttributes.includes(attribute)
        ) {

            return res.status(400).json({
                message: "Invalid attribute"
            });

        }


        // ----------------------------------------------
        // SERVER-CONTROLLED REWARDS
        // ----------------------------------------------

        const rewardMap = {
            1: {
                xp: 20,
                coins: 5
            },
            2: {
                xp: 40,
                coins: 10
            },
            3: {
                xp: 70,
                coins: 20
            }
        };

        const xpReward = rewardMap[cleanDifficulty].xp;
        const coinReward = rewardMap[cleanDifficulty].coins;


        // ----------------------------------------------
        // CREATE QUEST
        // ----------------------------------------------

        const result = await sql`
            INSERT INTO public.tasks
            (
                user_id,
                title,
                description,
                category,
                difficulty,
                xp_reward,
                coin_reward,
                status,
                attribute
            )
            VALUES
            (
                ${userId},
                ${title.trim()},
                ${description || null},
                ${category || "general"},
                ${cleanDifficulty},
                ${xpReward},
                ${coinReward},
                'pending',
                ${attribute || null}
            )
            RETURNING *
        `;


        res.status(201).json(result[0]);

    } catch (error) {

        console.error("Create task error:", error);

        res.status(500).json({
            message: "Failed to create quest"
        });

    }

});


// ======================================================
// GET QUESTS
// ======================================================

app.get("/tasks", requireAuth, async (req, res) => {

    try {

        const userId = req.user.id;

        const result = await sql`
            SELECT *
            FROM public.tasks
            WHERE user_id = ${userId}
            ORDER BY created_at DESC
        `;

        res.json(result);

    } catch (error) {

        console.error("Get tasks error:", error);

        res.status(500).json({
            message: "Failed to fetch quests"
        });

    }

});


// ======================================================
// COMPLETE QUEST
// ======================================================

app.post(
    "/tasks/:taskId/complete",
    requireAuth,
    async (req, res) => {

        try {

            const userId = req.user.id;
            const taskId = req.params.taskId;


            const result = await sql.begin(async (tx) => {

                // ------------------------------------------
                // LOCK QUEST
                // ------------------------------------------

                const taskResult = await tx`
                    SELECT *
                    FROM public.tasks
                    WHERE
                        id = ${taskId}
                        AND user_id = ${userId}
                    FOR UPDATE
                `;


                if (taskResult.length === 0) {

                    throw new Error("QUEST_NOT_FOUND");

                }


                const task = taskResult[0];


                if (task.status === "completed") {

                    throw new Error("QUEST_ALREADY_COMPLETED");

                }


                // ------------------------------------------
                // LOCK CHARACTER
                // ------------------------------------------

                const characterResult = await tx`
                    SELECT *
                    FROM public.characters
                    WHERE user_id = ${userId}
                    FOR UPDATE
                `;


                if (characterResult.length === 0) {

                    throw new Error("CHARACTER_NOT_FOUND");

                }


                const character = characterResult[0];


                // ------------------------------------------
                // STREAK
                // ------------------------------------------

                const todayResult = await tx`
                    SELECT CURRENT_DATE AS today
                `;

                const today = todayResult[0].today;

                const oldStreak =
                    Number(character.streak) || 0;

                let newStreak = oldStreak;

                const lastCompleted =
                    character.last_completed_date;


                if (!lastCompleted) {

                    newStreak = 1;

                } else if (
                    String(lastCompleted) === String(today)
                ) {

                    newStreak = oldStreak;

                } else {

                    const differenceResult = await tx`
                        SELECT
                            (
                                ${today}::date -
                                ${lastCompleted}::date
                            ) AS days
                    `;

                    const days =
                        Number(differenceResult[0].days);

                    if (days === 1) {

                        newStreak = oldStreak + 1;

                    } else {

                        newStreak = 1;

                    }

                }


                // ------------------------------------------
                // REWARDS
                // ------------------------------------------

                const xpGain =
                    Number(task.xp_reward) || 0;

                const coinGain =
                    Number(task.coin_reward) || 0;

                const oldXP =
                    Number(character.xp) || 0;

                const oldLevel =
                    Number(character.level) || 1;

                const newXP =
                    oldXP + xpGain;

                const newCoins =
                    (Number(character.coins) || 0) +
                    coinGain;


                // ------------------------------------------
                // NON-LINEAR LEVELING
                // ------------------------------------------

                let newLevel = oldLevel;

                while (
                    newLevel < 100 &&
                    newXP >= 100 * newLevel * newLevel
                ) {

                    newLevel++;

                }


                // ------------------------------------------
                // ATTRIBUTES
                // ------------------------------------------

                let strength =
                    Number(character.strength) || 0;

                let intellect =
                    Number(character.intellect) || 0;

                let discipline =
                    Number(character.discipline) || 0;

                let creativity =
                    Number(character.creativity) || 0;


                if (task.attribute === "strength") {
                    strength++;
                }

                if (task.attribute === "intellect") {
                    intellect++;
                }

                if (task.attribute === "discipline") {
                    discipline++;
                }

                if (task.attribute === "creativity") {
                    creativity++;
                }


                // ------------------------------------------
                // COMPLETE QUEST
                // ------------------------------------------

                const completedTaskResult = await tx`
                    UPDATE public.tasks
                    SET
                        status = 'completed',
                        completed_at = NOW(),
                        updated_at = NOW()
                    WHERE
                        id = ${taskId}
                        AND user_id = ${userId}
                        AND status <> 'completed'
                    RETURNING *
                `;


                if (completedTaskResult.length === 0) {

                    throw new Error("QUEST_ALREADY_COMPLETED");

                }


                // ------------------------------------------
                // UPDATE CHARACTER
                // ------------------------------------------

                const updatedCharacterResult = await tx`
                    UPDATE public.characters
                    SET
                        xp = ${newXP},
                        level = ${newLevel},
                        coins = ${newCoins},
                        streak = ${newStreak},
                        strength = ${strength},
                        intellect = ${intellect},
                        discipline = ${discipline},
                        creativity = ${creativity},
                        last_completed_date = ${today},
                        updated_at = NOW()
                    WHERE user_id = ${userId}
                    RETURNING *
                `;


                return {
                    task: completedTaskResult[0],
                    character: updatedCharacterResult[0],
                    xpGain,
                    coinGain,
                    oldStreak,
                    newStreak,
                    oldLevel,
                    newLevel
                };

            });


            res.json({

                message: "Quest completed successfully!",

                task: result.task,

                rewards: {
                    xp: result.xpGain,
                    coins: result.coinGain,
                    attribute: result.task.attribute
                },

                streak: {
                    previous: result.oldStreak,
                    current: result.newStreak
                },

                levelUp:
                    result.newLevel > result.oldLevel,

                character: result.character

            });


        } catch (error) {

            if (error.message === "QUEST_NOT_FOUND") {

                return res.status(404).json({
                    message: "Quest not found"
                });

            }

            if (error.message === "QUEST_ALREADY_COMPLETED") {

                return res.status(400).json({
                    message: "Quest is already completed"
                });

            }

            if (error.message === "CHARACTER_NOT_FOUND") {

                return res.status(404).json({
                    message: "Character not found"
                });

            }


            console.error("Complete quest error:", error);

            res.status(500).json({
                message: "Failed to complete quest"
            });

        }

    }
);


// ======================================================
// EDIT QUEST
// ======================================================

app.put(
    "/tasks/:taskId",
    requireAuth,
    async (req, res) => {

        try {

            const userId = req.user.id;
            const taskId = req.params.taskId;

            const {
                title,
                description,
                category,
                difficulty,
                attribute
            } = req.body;


            if (
                typeof title !== "string" ||
                title.trim().length === 0 ||
                title.length > 120
            ) {

                return res.status(400).json({
                    message: "Invalid quest title"
                });

            }


            const cleanDifficulty =
                Number(difficulty);

            if (![1, 2, 3].includes(cleanDifficulty)) {

                return res.status(400).json({
                    message: "Invalid difficulty"
                });

            }


            const allowedAttributes = [
                "strength",
                "intellect",
                "discipline",
                "creativity"
            ];


            if (
                attribute &&
                !allowedAttributes.includes(attribute)
            ) {

                return res.status(400).json({
                    message: "Invalid attribute"
                });

            }


            const rewardMap = {
                1: {
                    xp: 20,
                    coins: 5
                },
                2: {
                    xp: 40,
                    coins: 10
                },
                3: {
                    xp: 70,
                    coins: 20
                }
            };


            const result = await sql`
                UPDATE public.tasks
                SET
                    title = ${title.trim()},
                    description = ${description || null},
                    category = ${category || "general"},
                    difficulty = ${cleanDifficulty},
                    xp_reward = ${rewardMap[cleanDifficulty].xp},
                    coin_reward = ${rewardMap[cleanDifficulty].coins},
                    attribute = ${attribute || null},
                    updated_at = NOW()
                WHERE
                    id = ${taskId}
                    AND user_id = ${userId}
                    AND status <> 'completed'
                RETURNING *
            `;


            if (result.length === 0) {

                return res.status(404).json({
                    message:
                        "Quest not found or cannot be edited"
                });

            }


            res.json(result[0]);

        } catch (error) {

            console.error("Update task error:", error);

            res.status(500).json({
                message: "Failed to update quest"
            });

        }

    }
);


// ======================================================
// DELETE QUEST
// ======================================================

app.delete(
    "/tasks/:taskId",
    requireAuth,
    async (req, res) => {

        try {

            const userId = req.user.id;
            const taskId = req.params.taskId;


            const result = await sql`
                DELETE FROM public.tasks
                WHERE
                    id = ${taskId}
                    AND user_id = ${userId}
                RETURNING *
            `;


            if (result.length === 0) {

                return res.status(404).json({
                    message: "Quest not found"
                });

            }


            res.json({
                message: "Quest deleted successfully"
            });


        } catch (error) {

            console.error("Delete task error:", error);

            res.status(500).json({
                message: "Failed to delete quest"
            });

        }

    }
);


// ======================================================
// SHOP
// ======================================================

app.get("/shop", requireAuth, async (req, res) => {

    try {

        const result = await sql`
            SELECT
                id,
                name,
                description,
                price,
                item_type,
                created_at
            FROM public.shop_items
            ORDER BY price ASC
        `;

        res.json(result);

    } catch (error) {

        console.error("Shop error:", error);

        res.status(500).json({
            message: "Failed to fetch shop"
        });

    }

});


// ======================================================
// INVENTORY
// ======================================================

app.get(
    "/inventory",
    requireAuth,
    async (req, res) => {

        try {

            const userId = req.user.id;

            const result = await sql`
                SELECT
                    inventory.id,
                    inventory.user_id,
                    inventory.item_id,
                    inventory.purchased_at,
                    shop_items.name,
                    shop_items.description,
                    shop_items.price,
                    shop_items.item_type
                FROM public.inventory
                INNER JOIN public.shop_items
                    ON inventory.item_id = shop_items.id
                WHERE inventory.user_id = ${userId}
                ORDER BY inventory.purchased_at DESC
            `;

            res.json(result);

        } catch (error) {

            console.error("Inventory error:", error);

            res.status(500).json({
                message: "Failed to fetch inventory"
            });

        }

    }
);


// ======================================================
// BUY SHOP ITEM
// ======================================================

app.post(
    "/shop/:itemId/buy",
    requireAuth,
    async (req, res) => {

        try {

            const userId = req.user.id;
            const itemId = req.params.itemId;


            const result = await sql.begin(async (tx) => {

                // ------------------------------------------
                // GET ITEM
                // ------------------------------------------

                const itemResult = await tx`
                    SELECT *
                    FROM public.shop_items
                    WHERE id = ${itemId}
                `;


                if (itemResult.length === 0) {

                    throw new Error("ITEM_NOT_FOUND");

                }


                const item = itemResult[0];


                // ------------------------------------------
                // LOCK CHARACTER
                // ------------------------------------------

                const characterResult = await tx`
                    SELECT *
                    FROM public.characters
                    WHERE user_id = ${userId}
                    FOR UPDATE
                `;


                if (characterResult.length === 0) {

                    throw new Error("CHARACTER_NOT_FOUND");

                }


                const character =
                    characterResult[0];


                const currentCoins =
                    Number(character.coins) || 0;

                const price =
                    Number(item.price) || 0;


                // ------------------------------------------
                // CHECK COINS
                // ------------------------------------------

                if (currentCoins < price) {

                    throw new Error("NOT_ENOUGH_COINS");

                }


                const newCoins =
                    currentCoins - price;


                // ------------------------------------------
                // DEDUCT COINS
                // ------------------------------------------

                const updatedCharacterResult =
                    await tx`
                        UPDATE public.characters
                        SET
                            coins = ${newCoins},
                            updated_at = NOW()
                        WHERE user_id = ${userId}
                        RETURNING *
                    `;


                // ------------------------------------------
                // ADD INVENTORY
                // ------------------------------------------

                const inventoryResult = await tx`
                    INSERT INTO public.inventory
                    (
                        user_id,
                        item_id
                    )
                    VALUES
                    (
                        ${userId},
                        ${item.id}
                    )
                    RETURNING *
                `;


                return {
                    item,
                    inventory:
                        inventoryResult[0],
                    character:
                        updatedCharacterResult[0],
                    price,
                    newCoins
                };

            });


            res.status(201).json({

                message:
                    "Item purchased successfully!",

                item: result.item,

                inventory:
                    result.inventory,

                character:
                    result.character,

                purchase: {
                    price: result.price,
                    remainingCoins:
                        result.newCoins
                }

            });


        } catch (error) {

            if (error.message === "ITEM_NOT_FOUND") {

                return res.status(404).json({
                    message: "Shop item not found"
                });

            }

            if (error.message === "CHARACTER_NOT_FOUND") {

                return res.status(404).json({
                    message: "Character not found"
                });

            }

            if (error.message === "NOT_ENOUGH_COINS") {

                return res.status(400).json({
                    message: "Not enough coins"
                });

            }


            console.error("Purchase error:", error);

            res.status(500).json({
                message: "Failed to purchase item"
            });

        }

    }
);


// ======================================================
// START SERVER
// ======================================================

app.listen(5000, () => {

    console.log(
        `Life RPG backend running on http://localhost:5000`
    );

});