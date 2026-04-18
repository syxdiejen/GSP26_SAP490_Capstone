sap.ui.define([], function () {
    "use strict";

    function mapAvailableVariables(aResult) {
        return (aResult || []).map(function (oItem) {
            var sVarName = String(oItem.VarName || "").trim();

            return {
                id: oItem.VarId,
                varName: sVarName,
                label: sVarName,
                token: "{{" + sVarName + "}}",
                description: oItem.Description || "",
                isMandatory: oItem.IsMandatory === true || oItem.IsMandatory === "X"
            };
        });
    }

    function scanVariablesFromHtml(sBodyHtml, aAvailableVariables) {
        var aMatches = String(sBodyHtml || "").match(/\{\{[A-Za-z0-9_.]+\}\}/g) || [];
        var aUniqueTokens = Array.from(new Set(aMatches));

        return aUniqueTokens.map(function (sToken) {
            var oMatchedVariable = (aAvailableVariables || []).find(function (oVariable) {
                return String(oVariable.token || "").trim() === sToken;
            });

            if (oMatchedVariable) {
                return {
                    name: sToken,
                    description: oMatchedVariable.description || oMatchedVariable.label || "",
                    varName: oMatchedVariable.varName || "",
                    isMandatory: !!oMatchedVariable.isMandatory,
                    existsInSystem: true
                };
            }

            return {
                name: sToken,
                description: "Variable not found in system",
                varName: "",
                isMandatory: false,
                existsInSystem: false
            };
        });
    }

    return {
        mapAvailableVariables: mapAvailableVariables,
        scanVariablesFromHtml: scanVariablesFromHtml
    };
});