sap.ui.define([
    "zemail/template/app/util/template/TemplateNormalizer"
], function (TemplateNormalizer) {
    "use strict";

    function validateForm(oData) {
        var sTemplateName = TemplateNormalizer.trim(oData.templateName);
        var sSenderEmail = TemplateNormalizer.trim(oData.senderEmail);
        var sBodyHtml = String(oData.bodyHtml || "");

        var sVersion = TemplateNormalizer.normalizeVersion(oData.bodyVersion);
        var sLineType = TemplateNormalizer.normalizeLineType(oData.bodyLineType);
        var sLanguage = TemplateNormalizer.normalizeLanguage(oData.bodyLanguage);

        if (!sTemplateName) {
            return {
                valid: false,
                message: "Please enter Template Name"
            };
        }

        if (sSenderEmail && !TemplateNormalizer.isValidEmail(sSenderEmail)) {
            return {
                valid: false,
                message: "Please enter a valid Sender Email"
            };
        }

        if (!sLanguage) {
            return {
                valid: false,
                message: "Please enter Language"
            };
        }

        if (!sVersion) {
            return {
                valid: false,
                message: "Please enter Version"
            };
        }

        if (TemplateNormalizer.trim(oData.bodyVersion).length > 3) {
            return {
                valid: false,
                message: "Version must be at most 3 characters"
            };
        }

        if (!sLineType) {
            return {
                valid: false,
                message: "Please enter Line Type"
            };
        }

        if (TemplateNormalizer.trim(oData.bodyLineType).length !== 1) {
            return {
                valid: false,
                message: "Line Type must be exactly 1 character"
            };
        }

        if (!sBodyHtml.trim()) {
            return {
                valid: false,
                message: "Please enter Email Body HTML"
            };
        }

        return {
            valid: true
        };
    }

    function isBasicInfoValid(oData) {
        return !!(
            TemplateNormalizer.trim(oData.templateName) &&
            TemplateNormalizer.trim(oData.department) &&
            TemplateNormalizer.trim(oData.category)
        );
    }

    return {
        validateForm: validateForm,
        isBasicInfoValid: isBasicInfoValid
    };
});