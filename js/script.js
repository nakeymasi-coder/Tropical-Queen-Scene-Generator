"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("prompt-generator-form");
    const categoryPanels = Array.from(
        document.querySelectorAll(".category-panel")
    );
    const navigationButtons = Array.from(
        document.querySelectorAll(".category-nav-button")
    );
    const chipGroups = Array.from(
        document.querySelectorAll(".chip-group[data-multi-select='true']")
    );

    const randomizeButton = document.getElementById("randomize-all-btn");
    const generateButton = document.getElementById("generate-prompt-btn");
    const outputGenerateButton = document.getElementById(
        "generate-prompt-output-btn"
    );
    const clearAllButton = document.getElementById("clear-all-btn");
    const copyButton = document.getElementById("copy-prompt-btn");

    const promptOutput = document.getElementById("prompt-output");
    const outputStatus = document.getElementById("output-status");
    const validationSummary = document.getElementById("validation-summary");
    const qualityResult = document.getElementById("quality-result");
    const updateNeededMessage = document.getElementById(
        "update-needed-message"
    );

    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toast-message");

    const state = {
        lockedCategories: new Set(),
        generatedPrompt: "",
        hasGeneratedPrompt: false,
        toastTimer: null
    };

    const requiredFieldLabels = {
        "character-count": "Number of Women",
        "ethnicity-heritage": "Ethnicity or Heritage",
        "island-influence": "Island or Regional Influence",
        "celebration-type": "Celebration or Festival",
        "outfit-category": "Outfit Category",
        "background-location": "Background Location",
        "art-style": "Art Style",
        "shot-type": "Shot Type",
        orientation: "Image Orientation"
    };

    const randomizeSettings = {
        facialFeatures: { minimum: 1, maximum: 3 },
        makeup: { minimum: 1, maximum: 4 },
        costumeDetails: { minimum: 2, maximum: 5 },
        jewelry: { minimum: 0, maximum: 3 },
        atmosphericDetails: { minimum: 0, maximum: 4 }
    };

    function initialize() {
        initializeNavigation();
        initializeChipGroups();
        initializeCategoryLocks();
        initializeClearCategoryButtons();
        initializeFormTracking();
        initializeMainActions();
        synchronizeAllChipGroups();
        updateGroupDependentControls();
        setEmptyOutput();
    }

    function initializeNavigation() {
        navigationButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const targetPanelId = button.dataset.targetPanel;
                showPanel(targetPanelId);
            });

            button.addEventListener("keydown", (event) => {
                const currentIndex = navigationButtons.indexOf(button);
                let nextIndex = null;

                if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                    nextIndex = (currentIndex + 1) % navigationButtons.length;
                }

                if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                    nextIndex =
                        (currentIndex - 1 + navigationButtons.length) %
                        navigationButtons.length;
                }

                if (event.key === "Home") {
                    nextIndex = 0;
                }

                if (event.key === "End") {
                    nextIndex = navigationButtons.length - 1;
                }

                if (nextIndex !== null) {
                    event.preventDefault();
                    const nextButton = navigationButtons[nextIndex];
                    nextButton.focus();
                    showPanel(nextButton.dataset.targetPanel);
                }
            });
        });
    }

    function showPanel(panelId) {
        navigationButtons.forEach((button) => {
            const isActive = button.dataset.targetPanel === panelId;

            button.classList.toggle("active", isActive);
            button.setAttribute("aria-selected", String(isActive));
            button.tabIndex = isActive ? 0 : -1;
        });

        categoryPanels.forEach((panel) => {
            const isActive = panel.id === panelId;

            panel.hidden = !isActive;
            panel.classList.toggle("active", isActive);
        });
    }

    function initializeChipGroups() {
        chipGroups.forEach((group) => {
            const chips = Array.from(
                group.querySelectorAll(".option-chip[data-value]")
            );

            chips.forEach((chip) => {
                chip.setAttribute("aria-pressed", "false");

                chip.addEventListener("click", () => {
                    toggleChip(group, chip);
                });

                chip.addEventListener("keydown", (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        toggleChip(group, chip);
                    }
                });
            });
        });
    }

    function toggleChip(group, chip) {
        if (chip.disabled) {
            return;
        }

        const maximum = Number(group.dataset.maxSelections || 1);
        const isSelected = chip.classList.contains("selected");
        const selectedChips = getSelectedChips(group);

        if (!isSelected && selectedChips.length >= maximum) {
            showToast(
                `You can choose up to ${maximum} options in this section.`,
                "warning"
            );
            return;
        }

        setChipSelected(chip, !isSelected);
        synchronizeChipGroup(group);
        markPromptAsOutdated();
    }

    function setChipSelected(chip, selected) {
        chip.classList.toggle("selected", selected);
        chip.setAttribute("aria-pressed", String(selected));
    }

    function getSelectedChips(group) {
        return Array.from(group.querySelectorAll(".option-chip.selected"));
    }

    function synchronizeChipGroup(group) {
        const hiddenInput = group.parentElement.querySelector(
            "input[type='hidden'][data-field-key]"
        );

        if (!hiddenInput) {
            return;
        }

        const values = getSelectedChips(group).map(
            (chip) => chip.dataset.value
        );

        hiddenInput.value = values.join("|");
        hiddenInput.dispatchEvent(
            new Event("change", {
                bubbles: true
            })
        );
    }

    function synchronizeAllChipGroups() {
        chipGroups.forEach(synchronizeChipGroup);
    }

    function initializeCategoryLocks() {
        const lockButtons = Array.from(
            document.querySelectorAll(".lock-category-button")
        );

        lockButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const category = button.dataset.lockCategory;
                toggleCategoryLock(category, button);
            });
        });
    }

    function toggleCategoryLock(category, button) {
        const panel = getCategoryPanel(category);

        if (!panel) {
            return;
        }

        const isLocked = state.lockedCategories.has(category);

        if (isLocked) {
            state.lockedCategories.delete(category);
            button.setAttribute("aria-pressed", "false");
            button.textContent = "Lock";
            button.classList.remove("locked");
            panel.classList.remove("is-locked");
            showToast("Category unlocked.", "success");
        } else {
            state.lockedCategories.add(category);
            button.setAttribute("aria-pressed", "true");
            button.textContent = "Unlock";
            button.classList.add("locked");
            panel.classList.add("is-locked");
            showToast("Category locked.", "success");
        }
    }

    function getCategoryPanel(category) {
        return document.querySelector(
            `.category-panel[data-category="${category}"]`
        );
    }

    function initializeClearCategoryButtons() {
        const clearButtons = Array.from(
            document.querySelectorAll(".clear-category-button")
        );

        clearButtons.forEach((button) => {
            button.addEventListener("click", () => {
                const category = button.dataset.clearCategory;
                clearCategory(category);
            });
        });
    }

    function clearCategory(category) {
        const panel = getCategoryPanel(category);

        if (!panel) {
            return;
        }

        if (state.lockedCategories.has(category)) {
            showToast(
                "Unlock this category before clearing it.",
                "warning"
            );
            return;
        }

        resetControlsInside(panel);
        clearValidationStyles(panel);
        updateGroupDependentControls();
        markPromptAsOutdated();
        showToast("Category cleared.", "success");
    }

    function resetControlsInside(container) {
        const selects = Array.from(container.querySelectorAll("select"));
        const textareas = Array.from(container.querySelectorAll("textarea"));
        const textInputs = Array.from(
            container.querySelectorAll("input[type='text']")
        );
        const hiddenInputs = Array.from(
            container.querySelectorAll("input[type='hidden']")
        );
        const chips = Array.from(container.querySelectorAll(".option-chip"));

        selects.forEach((select) => {
            select.selectedIndex = 0;
        });

        textareas.forEach((textarea) => {
            textarea.value = "";
        });

        textInputs.forEach((input) => {
            input.value = "";
        });

        hiddenInputs.forEach((input) => {
            input.value = "";
        });

        chips.forEach((chip) => {
            setChipSelected(chip, false);
        });
    }

    function initializeFormTracking() {
        form.addEventListener("input", (event) => {
            if (event.target.matches("textarea, input, select")) {
                clearFieldError(event.target);
                markPromptAsOutdated();
            }
        });

        form.addEventListener("change", (event) => {
            if (event.target.id === "character-count") {
                updateGroupDependentControls();
            }

            if (event.target.matches("textarea, input, select")) {
                clearFieldError(event.target);
                markPromptAsOutdated();
            }
        });
    }

    function initializeMainActions() {
        randomizeButton.addEventListener("click", randomizeGenerator);
        generateButton.addEventListener("click", generatePrompt);
        outputGenerateButton.addEventListener("click", generatePrompt);
        clearAllButton.addEventListener("click", clearAll);
        copyButton.addEventListener("click", copyPrompt);
    }

    function randomizeGenerator() {
        setButtonLoading(randomizeButton, true);

        window.setTimeout(() => {
            categoryPanels.forEach((panel) => {
                const category = panel.dataset.category;

                if (state.lockedCategories.has(category)) {
                    return;
                }

                randomizePanel(panel);
            });

            updateGroupDependentControls();
            markPromptAsOutdated();
            setButtonLoading(randomizeButton, false);
            showToast(
                state.lockedCategories.size > 0
                    ? "Unlocked categories randomized."
                    : "Selections randomized.",
                "success"
            );
        }, 180);
    }

    function randomizePanel(panel) {
        const selects = Array.from(panel.querySelectorAll("select"));
        const groups = Array.from(
            panel.querySelectorAll(
                ".chip-group[data-multi-select='true']"
            )
        );

        selects.forEach((select) => {
            if (select.disabled) {
                return;
            }

            randomizeSelect(select);
        });

        groups.forEach((group) => {
            randomizeChipGroup(group);
        });
    }

    function randomizeSelect(select) {
        const availableOptions = Array.from(select.options).filter(
            (option) => option.value && !option.disabled
        );

        if (availableOptions.length === 0) {
            select.selectedIndex = 0;
            return;
        }

        if (
            select.id === "group-arrangement" &&
            getValue("characterCount") === "one adult woman"
        ) {
            const soloOption = availableOptions.find((option) =>
                option.value.includes("single confident focal subject")
            );

            if (soloOption) {
                select.value = soloOption.value;
                return;
            }
        }

        if (
            select.id === "interaction" &&
            getValue("characterCount") === "one adult woman"
        ) {
            select.selectedIndex = 0;
            return;
        }

        const optionalNoneAllowed =
            !select.required &&
            select.options.length > 0 &&
            select.options[0].value === "";

        if (optionalNoneAllowed && Math.random() < 0.16) {
            select.selectedIndex = 0;
            return;
        }

        const randomOption =
            availableOptions[
                Math.floor(Math.random() * availableOptions.length)
            ];

        select.value = randomOption.value;
    }

    function randomizeChipGroup(group) {
        const hiddenInput = group.parentElement.querySelector(
            "input[type='hidden'][data-field-key]"
        );
        const fieldKey = hiddenInput?.dataset.fieldKey || "";
        const settings = randomizeSettings[fieldKey] || {
            minimum: 0,
            maximum: Number(group.dataset.maxSelections || 1)
        };

        const chips = Array.from(
            group.querySelectorAll(".option-chip[data-value]")
        );

        chips.forEach((chip) => setChipSelected(chip, false));

        const maximum = Math.min(
            settings.maximum,
            Number(group.dataset.maxSelections || settings.maximum),
            chips.length
        );

        const minimum = Math.min(settings.minimum, maximum);
        const count =
            minimum +
            Math.floor(Math.random() * (maximum - minimum + 1));

        shuffleArray(chips)
            .slice(0, count)
            .forEach((chip) => setChipSelected(chip, true));

        synchronizeChipGroup(group);
    }

    function shuffleArray(items) {
        const copy = [...items];

        for (let index = copy.length - 1; index > 0; index -= 1) {
            const randomIndex = Math.floor(Math.random() * (index + 1));
            [copy[index], copy[randomIndex]] = [
                copy[randomIndex],
                copy[index]
            ];
        }

        return copy;
    }

    function updateGroupDependentControls() {
        const count = getValue("characterCount");
        const groupArrangement = document.getElementById(
            "group-arrangement"
        );
        const interaction = document.getElementById("interaction");

        const isSolo = count === "one adult woman";

        if (groupArrangement) {
            Array.from(groupArrangement.options).forEach((option) => {
                if (!option.value) {
                    return;
                }

                const soloSpecific = option.value.includes(
                    "single confident focal subject"
                );

                option.disabled = isSolo ? !soloSpecific : soloSpecific;
            });

            if (
                groupArrangement.selectedOptions[0]?.disabled ||
                (!isSolo &&
                    groupArrangement.value.includes(
                        "single confident focal subject"
                    ))
            ) {
                groupArrangement.selectedIndex = 0;
            }
        }

        if (interaction) {
            interaction.disabled = isSolo;

            if (isSolo) {
                interaction.selectedIndex = 0;
            }
        }
    }

    function validateForm() {
        clearAllValidationStyles();

        const missingFields = [];

        Object.entries(requiredFieldLabels).forEach(
            ([fieldId, fieldLabel]) => {
                const field = document.getElementById(fieldId);

                if (!field || !String(field.value).trim()) {
                    missingFields.push({
                        field,
                        label: fieldLabel
                    });

                    if (field) {
                        markFieldError(field);
                    }
                }
            }
        );

        if (missingFields.length > 0) {
            const labels = missingFields.map((item) => item.label);

            showValidation(
                `Please complete the required choices before generating your prompt: ${formatList(
                    labels
                )}.`,
                "error"
            );

            const firstMissingField = missingFields[0].field;

            if (firstMissingField) {
                const panel = firstMissingField.closest(".category-panel");

                if (panel) {
                    showPanel(panel.id);
                }

                window.setTimeout(() => {
                    firstMissingField.focus();
                }, 50);
            }

            return false;
        }

        const count = getValue("characterCount");
        const groupArrangement = getValue("groupArrangement");
        const interaction = getValue("interaction");

        if (
            count === "one adult woman" &&
            (isGroupOnlyText(groupArrangement) ||
                isGroupOnlyText(interaction))
        ) {
            showValidation(
                "Choose a group arrangement only when two or more women are selected.",
                "error"
            );
            showPanel("character-panel");
            return false;
        }

        hideValidation();
        return true;
    }

    function isGroupOnlyText(value) {
        if (!value) {
            return false;
        }

        const normalized = value.toLowerCase();

        return [
            "together",
            "friends",
            "group",
            "one another",
            "troupe",
            "lineup",
            "formation"
        ].some((word) => normalized.includes(word));
    }

    function generatePrompt() {
        if (!validateForm()) {
            showToast(
                "Please complete the required choices.",
                "error"
            );
            return;
        }

        setGenerateLoading(true);

        window.setTimeout(() => {
            const prompt = assemblePrompt();

            state.generatedPrompt = prompt;
            state.hasGeneratedPrompt = true;

            renderPrompt(prompt);
            generatePremiumOutputs(prompt);
            renderQualityResult(prompt);
            hideValidation();
            updateNeededMessage.hidden = true;
            setGenerateLoading(false);
            showToast("Your prompt is ready.", "success");
        }, 220);
    }

    function assemblePrompt() {
        const count = getValue("characterCount");
        const isSolo = count === "one adult woman";

        const subjectParts = [
            count,
            getValue("ageRange"),
            getValue("ethnicityHeritage"),
            getValue("skinTone"),
            getValue("bodyType")
        ];

        const facialFeatures = getMultiValues("facialFeatures");
        const characterCustom = getValue("characterCustomDetails");

        const sceneParts = [
            getValue("celebrationType"),
            getValue("islandInfluence")
                ? `inspired by ${getValue("islandInfluence")}`
                : "",
            getValue("sceneContext"),
            getValue("culturalDirection"),
            getValue("themeCustomDetails")
        ];

        const hairBeautyParts = [
            getValue("hairLength"),
            getValue("hairStyle"),
            getValue("hairColor"),
            getValue("hairAccessory"),
            ...getMultiValues("makeup"),
            getValue("eyelashes"),
            getValue("nailStyle"),
            getValue("bodyDecoration"),
            getValue("beautyCustomDetails")
        ];

        const clothingParts = [
            getValue("outfitCategory"),
            getValue("outfitSilhouette"),
            ...getMultiValues("costumeDetails"),
            getValue("shoeStyle"),
            ...getMultiValues("jewelry"),
            getValue("prop"),
            getValue("clothingCustomDetails")
        ];

        const poseParts = [
            getValue("groupArrangement"),
            getValue("pose"),
            getValue("movement"),
            getValue("facialExpression"),
            getValue("eyeDirection"),
            isSolo ? "" : getValue("interaction"),
            getValue("energyLevel"),
            getValue("poseCustomDetails")
        ];

        const backgroundParts = [
            getValue("backgroundLocation"),
            getValue("crowdPresence"),
            getValue("timeOfDay"),
            getValue("weather"),
            ...getMultiValues("atmosphericDetails"),
            getValue("backgroundCustomDetails")
        ];

        const styleParts = [
            getValue("artStyle"),
            getValue("realismLevel"),
            getValue("mood"),
            getValue("colorPalette"),
            getValue("lighting"),
            getValue("depthStyle"),
            getValue("styleCustomDetails")
        ];

        const cameraParts = [
            getValue("shotType"),
            getValue("cameraAngle"),
            getValue("composition"),
            getValue("orientation"),
            getValue("imageQuality"),
            getValue("renderingPriority"),
            getValue("finalCustomDetails")
        ];

        const subjectSentence = buildSubjectSentence(
            subjectParts,
            facialFeatures,
            characterCustom
        );

        const sentences = [
            subjectSentence,
            buildSentence(
                "Create the scene around",
                sceneParts
            ),
            buildSentence(
                isSolo
                    ? "Style her with"
                    : "Style the women with",
                hairBeautyParts
            ),
            buildSentence(
                isSolo
                    ? "Dress her in"
                    : "Dress them in",
                clothingParts
            ),
            buildSentence(
                "Show the subject",
                poseParts
            ),
            buildSentence(
                "Place the scene in",
                backgroundParts
            ),
            buildSentence(
                "Use",
                styleParts
            ),
            buildSentence(
                "Frame the image as",
                cameraParts
            ),
            "Maintain believable adult anatomy, natural proportions, cohesive lighting, culturally respectful details, one clear focal direction, and a polished professional finish."
        ];

        return cleanPrompt(sentences.filter(Boolean).join(" "));
    }

    function buildSubjectSentence(
        subjectParts,
        facialFeatures,
        customDetails
    ) {
        const cleanSubjectParts = uniqueValues(subjectParts);
        const subjectDescription = formatList(cleanSubjectParts);

        const additionalDetails = [];

        if (facialFeatures.length > 0) {
            additionalDetails.push(
                `featuring ${formatList(facialFeatures)}`
            );
        }

        if (customDetails) {
            additionalDetails.push(customDetails);
        }

        let sentence = `Create an original Caribbean-themed image featuring ${subjectDescription}`;

        if (additionalDetails.length > 0) {
            sentence += `, ${additionalDetails.join(", ")}`;
        }

        return ensureSentence(sentence);
    }

    function buildSentence(prefix, values) {
        const cleaned = uniqueValues(values);

        if (cleaned.length === 0) {
            return "";
        }

        return ensureSentence(`${prefix} ${formatList(cleaned)}`);
    }

    function cleanPrompt(prompt) {
        return prompt
            .replace(/\s+/g, " ")
            .replace(/\s+,/g, ",")
            .replace(/,\s*,+/g, ",")
            .replace(/\.\s*\./g, ".")
            .replace(/\s+\./g, ".")
            .trim();
    }

    function ensureSentence(text) {
        const cleaned = cleanPrompt(text);

        if (!cleaned) {
            return "";
        }

        return /[.!?]$/.test(cleaned) ? cleaned : `${cleaned}.`;
    }

    function uniqueValues(values) {
        const seen = new Set();

        return values
            .flat()
            .map((value) => String(value || "").trim())
            .filter(Boolean)
            .filter((value) => {
                const normalized = value.toLowerCase();

                if (seen.has(normalized)) {
                    return false;
                }

                seen.add(normalized);
                return true;
            });
    }

    function formatList(values) {
        const cleaned = uniqueValues(values);

        if (cleaned.length === 0) {
            return "";
        }

        if (cleaned.length === 1) {
            return cleaned[0];
        }

        if (cleaned.length === 2) {
            return `${cleaned[0]} and ${cleaned[1]}`;
        }

        return `${cleaned.slice(0, -1).join(", ")}, and ${
            cleaned[cleaned.length - 1]
        }`;
    }

    function getValue(fieldKey) {
        const field = form.querySelector(
            `[data-field-key="${fieldKey}"]`
        );

        return field ? String(field.value || "").trim() : "";
    }

    function getMultiValues(fieldKey) {
        const value = getValue(fieldKey);

        if (!value) {
            return [];
        }

        return value
            .split("|")
            .map((item) => item.trim())
            .filter(Boolean);
    }

    function renderPrompt(prompt) {
        promptOutput.classList.remove("empty");
        promptOutput.textContent = prompt;

        outputStatus.textContent = "Generated";
        outputStatus.className = "output-status success";

        copyButton.disabled = false;
    }

    function setEmptyOutput() {
        promptOutput.classList.add("empty");
        promptOutput.innerHTML =
            '<p class="empty-state" id="prompt-empty-state">Your polished Caribbean image prompt will appear here.</p>';

        outputStatus.textContent = "Not generated";
        outputStatus.className = "output-status";

        copyButton.disabled = true;
        qualityResult.hidden = true;
        qualityResult.textContent = "";
        qualityResult.className = "quality-result";
        updateNeededMessage.hidden = true;
    }

    function renderQualityResult(prompt) {
        const requiredCount = Object.keys(requiredFieldLabels).length;
        const completedRequiredCount = Object.keys(
            requiredFieldLabels
        ).filter((id) => {
            const element = document.getElementById(id);
            return element && String(element.value).trim();
        }).length;

        const wordCount = prompt
            .split(/\s+/)
            .filter(Boolean).length;

        const hasSubject = Boolean(getValue("characterCount"));
        const hasCulture =
            Boolean(getValue("islandInfluence")) &&
            Boolean(getValue("celebrationType"));
        const hasWardrobe = Boolean(getValue("outfitCategory"));
        const hasBackground = Boolean(
            getValue("backgroundLocation")
        );
        const hasStyle = Boolean(getValue("artStyle"));
        const hasComposition =
            Boolean(getValue("shotType")) &&
            Boolean(getValue("orientation"));

        const qualityChecks = [
            completedRequiredCount === requiredCount,
            hasSubject,
            hasCulture,
            hasWardrobe,
            hasBackground,
            hasStyle,
            hasComposition,
            wordCount >= 80
        ];

        const passedChecks = qualityChecks.filter(Boolean).length;

        qualityResult.hidden = false;

        if (passedChecks === qualityChecks.length) {
            qualityResult.className = "quality-result success";
            qualityResult.textContent =
                "Prompt quality check: Complete, detailed, and ready to copy.";
            return;
        }

        if (passedChecks >= qualityChecks.length - 2) {
            qualityResult.className = "quality-result warning";
            qualityResult.textContent =
                "Prompt quality check: Ready to use. Add more optional details for a richer result.";
            return;
        }

        qualityResult.className = "quality-result error";
        qualityResult.textContent =
            "Prompt quality check: Add more scene, styling, or composition details before copying.";
    }

    function markPromptAsOutdated() {
        if (!state.hasGeneratedPrompt) {
            return;
        }

        updateNeededMessage.hidden = false;
        outputStatus.textContent = "Update needed";
        outputStatus.className = "output-status warning";
    }

    async function copyPrompt() {
        if (!state.generatedPrompt) {
            showToast("Generate a prompt before copying.", "warning");
            return;
        }

        try {
            await navigator.clipboard.writeText(state.generatedPrompt);
            showToast("Prompt copied.", "success");
        } catch (error) {
            const copied = fallbackCopy(state.generatedPrompt);

            if (copied) {
                showToast("Prompt copied.", "success");
            } else {
                showToast(
                    "The prompt could not be copied automatically.",
                    "error"
                );
            }
        }
    }

    function fallbackCopy(text) {
        const temporaryTextarea = document.createElement("textarea");

        temporaryTextarea.value = text;
        temporaryTextarea.setAttribute("readonly", "");
        temporaryTextarea.style.position = "fixed";
        temporaryTextarea.style.opacity = "0";
        temporaryTextarea.style.pointerEvents = "none";

        document.body.appendChild(temporaryTextarea);
        temporaryTextarea.select();
        temporaryTextarea.setSelectionRange(0, text.length);

        let successful = false;

        try {
            successful = document.execCommand("copy");
        } catch (error) {
            successful = false;
        }

        temporaryTextarea.remove();
        return successful;
    }

    function clearAll() {
        resetControlsInside(form);

        state.lockedCategories.clear();
        state.generatedPrompt = "";
        state.hasGeneratedPrompt = false;

        document
            .querySelectorAll(".lock-category-button")
            .forEach((button) => {
                button.setAttribute("aria-pressed", "false");
                button.textContent = "Lock";
                button.classList.remove("locked");
            });

        categoryPanels.forEach((panel) => {
            panel.classList.remove("is-locked");
        });

        clearAllValidationStyles();
        hideValidation();
        updateGroupDependentControls();
        setEmptyOutput();
        resetPremiumOutputs();
        showPanel("character-panel");

        showToast("Generator cleared.", "success");
    }

    function markFieldError(field) {
        const formField = field.closest(".form-field");

        if (formField) {
            formField.classList.add("has-error");
        }

        field.setAttribute("aria-invalid", "true");
    }

    function clearFieldError(field) {
        const formField = field.closest(".form-field");

        if (formField) {
            formField.classList.remove("has-error");
        }

        field.removeAttribute("aria-invalid");
    }

    function clearValidationStyles(container) {
        container
            .querySelectorAll(".form-field.has-error")
            .forEach((field) => {
                field.classList.remove("has-error");
            });

        container
            .querySelectorAll("[aria-invalid='true']")
            .forEach((field) => {
                field.removeAttribute("aria-invalid");
            });
    }

    function clearAllValidationStyles() {
        clearValidationStyles(form);
    }

    function showValidation(message, type = "error") {
        validationSummary.hidden = false;
        validationSummary.textContent = message;
        validationSummary.className = "validation-summary";

        if (type !== "error") {
            validationSummary.classList.add(type);
        }

        validationSummary.scrollIntoView({
            behavior: prefersReducedMotion() ? "auto" : "smooth",
            block: "center"
        });
    }

    function hideValidation() {
        validationSummary.hidden = true;
        validationSummary.textContent = "";
        validationSummary.className = "validation-summary";
    }

    function showToast(message, type = "") {
        if (state.toastTimer) {
            window.clearTimeout(state.toastTimer);
        }

        toast.hidden = false;
        toast.className = "toast";

        if (type) {
            toast.classList.add(type);
        }

        toastMessage.textContent = message;

        state.toastTimer = window.setTimeout(() => {
            toast.hidden = true;
            toastMessage.textContent = "";
            toast.className = "toast";
        }, 2800);
    }

    function setGenerateLoading(loading) {
        setButtonLoading(generateButton, loading);
        setButtonLoading(outputGenerateButton, loading);
    }

    function setButtonLoading(button, loading) {
        if (!button) {
            return;
        }

        button.classList.toggle("is-loading", loading);
        button.disabled = loading;
        button.setAttribute("aria-busy", String(loading));
    }

    function prefersReducedMotion() {
        return window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;
    }



    /* Premium Output Modules */
    const premiumTabs = Array.from(document.querySelectorAll(".premium-tab"));
    const premiumPanels = Array.from(document.querySelectorAll(".premium-panel"));
    const premiumCopyButtons = Array.from(document.querySelectorAll(".premium-copy-button"));
    const premiumOutputIds = ["suno-output", "video-output", "marketing-output", "custom-gpt-output"];

    function initializePremiumModules() {
        premiumTabs.forEach((tab, index) => {
            tab.addEventListener("click", () => showPremiumPanel(tab.dataset.premiumTarget));
            tab.addEventListener("keydown", (event) => {
                let nextIndex = null;
                if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (index + 1) % premiumTabs.length;
                if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (index - 1 + premiumTabs.length) % premiumTabs.length;
                if (event.key === "Home") nextIndex = 0;
                if (event.key === "End") nextIndex = premiumTabs.length - 1;
                if (nextIndex !== null) {
                    event.preventDefault();
                    const nextTab = premiumTabs[nextIndex];
                    nextTab.focus();
                    showPremiumPanel(nextTab.dataset.premiumTarget);
                }
            });
        });

        premiumCopyButtons.forEach((button) => {
            button.addEventListener("click", async () => {
                const output = document.getElementById(button.dataset.copyPremium);
                const text = output?.dataset.generatedText || "";
                if (!text) { showToast("Generate the main prompt first.", "warning"); return; }
                try { await navigator.clipboard.writeText(text); showToast("Premium output copied.", "success"); }
                catch (error) { const copied = fallbackCopy(text); showToast(copied ? "Premium output copied." : "The output could not be copied automatically.", copied ? "success" : "error"); }
            });
        });
        resetPremiumOutputs();
    }

    function showPremiumPanel(panelId) {
        premiumTabs.forEach((tab) => {
            const active = tab.dataset.premiumTarget === panelId;
            tab.classList.toggle("active", active);
            tab.setAttribute("aria-selected", String(active));
            tab.tabIndex = active ? 0 : -1;
        });
        premiumPanels.forEach((panel) => {
            const active = panel.id === panelId;
            panel.hidden = !active;
            panel.classList.toggle("active", active);
        });
    }

    function collectPremiumGeneratorData() {
        return {
            characterCount: getValue("characterCount") || "one adult woman",
            heritage: getValue("ethnicityHeritage") || "Caribbean",
            island: getValue("islandInfluence") || "the Caribbean",
            celebration: getValue("celebrationType") || "a Caribbean cultural celebration",
            scene: getValue("sceneContext") || "a vibrant tropical setting",
            artStyle: getValue("artStyle") || "cinematic realism",
            mood: getValue("mood") || "joyful, bold, and celebratory",
            palette: getValue("colorPalette") || "vibrant tropical colors with gold accents",
            lighting: getValue("lighting") || "warm cinematic lighting",
            outfit: getValue("outfitCategory") || "Caribbean-inspired fashion",
            background: getValue("backgroundLocation") || "a vibrant Caribbean setting",
            movement: getValue("movement") || getValue("pose") || "graceful celebratory movement",
            expression: getValue("facialExpression") || "a radiant joyful expression",
            energy: getValue("energyLevel") || "warm joyful energy",
            orientation: getValue("orientation") || "vertical portrait orientation",
            atmosphere: formatList(getMultiValues("atmosphericDetails")),
            costumeDetails: formatList(getMultiValues("costumeDetails")),
            mainPrompt: state.generatedPrompt || ""
        };
    }

    function generatePremiumOutputs(mainPrompt) {
        if (!mainPrompt) { resetPremiumOutputs(); return; }
        const data = collectPremiumGeneratorData();
        setPremiumOutput("suno-output", buildSunoMusicPrompt(data));
        setPremiumOutput("video-output", buildVideoScript(data));
        setPremiumOutput("marketing-output", buildMarketingPrompt(data));
        setPremiumOutput("custom-gpt-output", buildCustomGptConfiguration(data));
    }

    function buildSunoMusicPrompt(data) {
        return `SUNO AI MUSIC PROMPT

SONG TITLE
Tropical Queen Rising

CORE SONG CONCEPT
Create a fully original Caribbean-inspired celebration anthem connected to ${data.celebration} and ${data.island}. Center confidence, sisterhood, cultural pride, movement, joy, beauty, and stepping boldly into the spotlight.

GENRE AND STYLE
Blend modern soca, dancehall, Afro-Caribbean percussion, tropical pop, cinematic festival music, and polished contemporary R&B.

VOCAL DIRECTION
Use a confident adult female lead with layered female harmonies, celebratory chants, call-and-response moments, and a powerful final chorus. Communicate ${data.energy} and ${data.expression}.

MOOD
${capitalizeText(data.mood)}.

INSTRUMENTATION
Steelpan accents, Caribbean drums, congas, shakers, bass guitar, rhythmic guitar, warm synths, brass bursts, claps, cinematic percussion, and crowd-style vocal textures. Build the rhythm around ${data.movement}.

SONG STRUCTURE
Intro: Island atmosphere and distant percussion.
Verse 1: Confidence, beauty, cultural pride, and preparation.
Pre-Chorus: Rising drums and harmonies.
Chorus: A bold tropical-queen sing-along hook.
Verse 2: Movement, sisterhood, fashion, color, and ${data.celebration}.
Bridge: Pride, freedom, and becoming.
Final Chorus: Full percussion, harmonies, chants, brass, and festival energy.
Outro: Steelpan, crowd vocals, and a confident final line.

LYRICAL THEMES
Caribbean pride, feminine power, sisterhood, radiant beauty, island energy, dancing, cultural joy, and owning the moment.

VISUAL CONNECTION
Translate ${data.palette}, ${data.lighting}, ${data.outfit}, and ${data.background} into sound.

PRODUCTION QUALITY
Radio-ready mix, clean vocals, strong low end, bright percussion, controlled dynamics, and a cinematic festival finish.

ORIGINALITY RULE
Create a fully original song. Do not imitate a named singer, copyrighted song, protected melody, or existing recording.`;
    }

    function buildVideoScript(data) {
        const plural = data.characterCount !== "one adult woman";
        const subject = plural ? "the women" : "the woman";
        const pronoun = plural ? "they" : "she";
        return `VIDEO SCRIPT PROMPT

VIDEO TITLE
Tropical Queen Scene

VIDEO LENGTH
45 seconds

VIDEO FORMAT
${capitalizeText(data.orientation)}

CREATIVE DIRECTION
Create a professionally polished Caribbean-inspired fashion and celebration video based on ${data.celebration} and ${data.island}. Feature ${data.characterCount}, styled in ${data.outfit}. Use ${data.artStyle}, ${data.palette}, ${data.lighting}, and ${data.mood}.

SCENE 1 — OPENING ESTABLISHING SHOT | 0–5 seconds
VISUAL: Wide cinematic view of ${data.background}. ${data.atmosphere ? `Include ${data.atmosphere}.` : "Include tropical movement and subtle cultural atmosphere."}
CAMERA: Slow forward movement.
AUDIO: Distant Caribbean percussion and rising musical pulse.
ON-SCREEN TEXT: “Tropical Queen Energy”

SCENE 2 — CHARACTER REVEAL | 5–12 seconds
VISUAL: Reveal ${data.characterCount} with ${data.expression}. ${data.costumeDetails ? `Highlight ${data.costumeDetails}.` : "Highlight polished Caribbean-inspired fashion details."}
CAMERA: Smooth upward reveal from outfit details to the face.
VOICEOVER: “This is more than a look. This is culture, confidence, and celebration in motion.”

SCENE 3 — BEAUTY AND FASHION DETAILS | 12–20 seconds
VISUAL: Close-ups of hair, makeup, jewelry, fabric, feathers, beadwork, and movement.
CAMERA: Close-ups, side angles, and a rotating fashion shot.
VOICEOVER: “Every color tells a story. Every detail carries the spirit of the islands.”

SCENE 4 — MOVEMENT AND CELEBRATION | 20–31 seconds
VISUAL: Show ${subject} moving with ${data.movement}. ${capitalizeText(pronoun)} should appear confident, natural, joyful, and connected to the environment.
CAMERA: Tracking shots, one low-angle confidence shot, and one wide scene.
VOICEOVER: “Bold enough to be seen. Free enough to move. Powerful enough to own the moment.”

SCENE 5 — HERO MOMENT | 31–40 seconds
VISUAL: Strongest hero shot with ${data.energy}, polished lighting, and clear focus.
CAMERA: Slow cinematic push-in.
VOICEOVER: “She is the celebration. She is the rhythm. She is the tropical queen.”

SCENE 6 — FINAL FRAME | 40–45 seconds
VISUAL: Confident final pose with fabric, feathers, light, or atmosphere continuing to move.
ON-SCREEN TEXT: “Tropical Queen Scene Generator”
SECONDARY TEXT: “Create the vision. Build the prompt. Bring the scene to life.”
AUDIO: Strong percussion hit and layered female vocal chant.

VIDEO QUALITY REQUIREMENTS
Use believable adult anatomy, realistic movement, stable faces, consistent wardrobes, cohesive lighting, smooth transitions, readable text, and professional color grading. Avoid warped hands, flicker, duplicated characters, or changing costumes.`;
    }

    function buildMarketingPrompt(data) {
        return `MARKETING CONTENT PROMPT

ROLE
Act as a professional Caribbean-inspired creative marketing strategist and conversion-focused copywriter.

CONCEPT
Promote a visual concept featuring ${data.characterCount}, ${data.heritage} representation, ${data.celebration}, and ${data.island} inspiration.

VISUAL DIRECTION
Reflect ${data.artStyle}, ${data.mood}, ${data.palette}, ${data.lighting}, ${data.outfit}, and ${data.background}.

TARGET AUDIENCE
Content creators, AI art creators, Caribbean culture enthusiasts, fashion lovers, digital-product customers, event promoters, and social media users who enjoy bold tropical imagery and culturally respectful storytelling.

CREATE ALL COMPLETE DELIVERABLES
1. One memorable campaign title.
2. One hook under 15 words.
3. One 80–120 word product or project description.
4. One finished Instagram/Facebook caption with CTA.
5. One concise TikTok caption with hook and CTA.
6. One searchable Pinterest title.
7. One complete Pinterest description using natural search keywords.
8. One compelling email subject line.
9. One short preview line.
10. One complete promotional email with opening, concept, benefit, CTA, and warm closing.
11. Three short CTAs: engagement, purchase/download, and share.
12. Twelve relevant hashtags.

TONE
Bold, warm, celebratory, polished, feminine, culturally respectful, and confident. Avoid stereotypes, careless blending of traditions, generic corporate language, and exaggerated promises.

MAIN VISUAL REFERENCE
${data.mainPrompt}

FINAL REQUIREMENT
Return complete copy-and-paste-ready marketing content, not an outline or placeholders.`;
    }

    function buildCustomGptConfiguration(data) {
        return `COMPLETE CUSTOM GPT CONFIGURATION

GPT NAME
Tropical Queen Scene Creator

GPT PURPOSE
Help users create polished Caribbean-themed image prompts featuring one to four adult women while keeping every result cohesive, beginner-friendly, and culturally respectful.

SUGGESTED WELCOME MESSAGE
Welcome to Tropical Queen Scene Creator. Tell me what kind of Caribbean-inspired image you want, or share the island influence, celebration, number of women, outfit, mood, and art style. I’ll turn your choices into one polished image prompt.

COMPLETE CUSTOM GPT INSTRUCTIONS
You are Tropical Queen Scene Creator, a professional Caribbean-themed AI image prompt specialist.

GOALS AND RESPONSIBILITIES
- Guide users through subject, culture, fashion, beauty, pose, environment, art style, lighting, camera view, and quality.
- Ask only for genuinely missing information and no more than five focused questions at once.
- Accept short answers, detailed descriptions, or reference images.
- Produce one natural, polished, ready-to-copy image prompt.
- Preserve the selected island, celebration, character count, wardrobe, colors, mood, and composition.
- Remove empty details, contradictions, and repetition.

CHARACTER RULES
- Adult women only.
- Never generate children, teenagers, age-ambiguous subjects, or male characters.
- Support one to four adult women and never exceed four.
- Remove group-only language from solo scenes.
- Define arrangement and interaction clearly for groups.
- Preserve natural body diversity and believable adult anatomy.

CULTURAL RULES
- Treat Caribbean cultures as distinct.
- Keep details aligned with the chosen island or festival.
- Use “Caribbean-inspired” or “heritage-inspired” when exact traditional accuracy is not established.
- Avoid stereotypes, caricatures, sexualized assumptions, and unsupported claims of authenticity.

OUTPUT ORDER
1. Character count and identity.
2. Caribbean heritage or island influence.
3. Celebration and scene concept.
4. Appearance and facial details.
5. Hair, makeup, nails, and beauty.
6. Clothing, jewelry, accessories, and props.
7. Pose, movement, expression, and interaction.
8. Background, crowd, weather, and atmosphere.
9. Art style, mood, colors, and lighting.
10. Camera, composition, orientation, and quality.
11. Final anatomy and consistency direction.

BEHAVIOR AND RESPONSE GUIDELINES
- Begin by asking what the user wants to create.
- Do not repeat answered questions.
- Analyze reference images for visible style, mood, color, subject count, wardrobe, composition, environment, and lighting.
- Treat references as inspiration only and never copy them exactly.
- Do not identify real people in images.
- Resolve contradictions before producing the final prompt.
- Keep the final answer copy-and-paste ready with no unnecessary explanation.

TONE AND PERSONALITY
Warm, clear, creative, confident, direct, beginner-friendly, culturally thoughtful, and professional.

RULES AND LIMITATIONS
- Adult women only; maximum four.
- No males or minors.
- No automatic negative prompt.
- No careless cultural mixing.
- No crowns or tiaras unless requested.
- No fake HUDs, dashboards, analytics, scan lines, or floating tech clutter unless requested.
- No random decorations that weaken the focal point.

SUGGESTED KNOWLEDGE FILES TO UPLOAD
1. Generator category guide.
2. Caribbean island and regional reference guide.
3. Carnival and festival reference guide.
4. Culturally respectful language guide.
5. Fashion, costume, fabric, and jewelry vocabulary guide.
6. Hair, makeup, and beauty guide.
7. Camera and composition guide.
8. Lighting and color palette guide.
9. Image-prompt quality checklist.
10. Brand voice and visual style guide.

CONVERSATION STARTERS
1. Create a Trinidad Carnival image prompt with three adult women in feathered costumes.
2. Help me design a luxury Caribbean resort fashion scene featuring one woman.
3. Turn my reference image into an original Caribbean-inspired prompt without copying it.
4. Create a Jamaica Carnival group scene with four adult women dancing in formation.
5. Help me choose the best island influence, style, colors, and lighting.

BEST PRACTICES FOR USING THE GPT
- Name the island, country, festival, or influence when possible.
- State the number of adult women.
- Add outfit, art style, mood, colors, and setting.
- Review cultural details before publishing or selling.
- Use references for inspiration, not duplication.
- Explain exactly what should change when regenerating.

TESTING CHECKLIST
1. Never creates male characters.
2. Never creates minors.
3. Never exceeds four main characters.
4. Solo scenes remove group language.
5. Group scenes define arrangement and interaction.
6. Specific festivals do not receive unrelated traditions.
7. References remain inspiration only.
8. Minimal requests trigger focused questions.
9. Detailed requests do not repeat answered questions.
10. Final result is one cohesive prompt.
11. Empty selections are omitted.
12. Repetition is removed.
13. Composition, lighting, and quality are included.
14. Tone stays professional and beginner-friendly.
15. No negative prompt is added unless requested.

CURRENT CREATIVE DIRECTION EXAMPLE
Characters: ${data.characterCount}
Heritage: ${data.heritage}
Island influence: ${data.island}
Celebration: ${data.celebration}
Scene: ${data.scene}
Wardrobe: ${data.outfit}
Art style: ${data.artStyle}
Mood: ${data.mood}
Colors: ${data.palette}
Lighting: ${data.lighting}
Background: ${data.background}`;
    }

    function setPremiumOutput(outputId, text) {
        const output = document.getElementById(outputId);
        if (!output || !text) return;
        output.textContent = text.trim();
        output.dataset.generatedText = text.trim();
        output.classList.remove("empty");
        output.classList.add("generated");
        const button = document.querySelector(`[data-copy-premium="${outputId}"]`);
        if (button) button.disabled = false;
    }

    function resetPremiumOutputs() {
        const messages = {
            "suno-output": "Generate your main image prompt to create the matching Suno music prompt.",
            "video-output": "Generate your main image prompt to create the matching video script.",
            "marketing-output": "Generate your main image prompt to create the matching marketing prompt.",
            "custom-gpt-output": "Generate your main image prompt to create the complete Custom GPT configuration."
        };
        premiumOutputIds.forEach((id) => {
            const output = document.getElementById(id);
            if (!output) return;
            output.textContent = messages[id];
            output.dataset.generatedText = "";
            output.classList.add("empty");
            output.classList.remove("generated");
            const button = document.querySelector(`[data-copy-premium="${id}"]`);
            if (button) button.disabled = true;
        });
    }

    function capitalizeText(value) {
        const text = String(value || "").trim();
        return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
    }

    initializePremiumModules();

    initialize();
});