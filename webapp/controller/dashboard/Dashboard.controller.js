sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], function (Controller, JSONModel) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.dashboard.Dashboard", {

        onInit: function () {
            this._loadEmailTemplateKPI();
            this._loadEmailLogKPI();
            this._loadTemplateByCategoryChart();
            this._loadEmailTrafficByMonthChart();
            var oDonutCategory = this.byId("idDonutTemplateByCategory");
            if (oDonutCategory) {
                oDonutCategory.setVizProperties({
                    title: { visible: false },
                    legend: { visible: true },
                    plotArea: {
                        dataLabel: { visible: true }
                    }
                });
            }

            var oDonutEmailHealth = this.byId("idDonutEmailHealth");
            if (oDonutEmailHealth) {
                oDonutEmailHealth.setVizProperties({
                    title: { visible: false },
                    legend: { visible: true },
                    plotArea: {
                        dataLabel: { visible: true }
                    }
                });
            }

            var oColumnChart = this.byId("idColumnEmailTrafficByMonth");
            if (oColumnChart) {
                oColumnChart.setVizProperties({
                    title: { visible: false },
                    valueAxis: {
                        title: { visible: true, text: "Emails" }
                    },
                    categoryAxis: {
                        title: { visible: true, text: "Month" }
                    },
                    plotArea: {
                        dataLabel: { visible: true }
                    },
                    legend: {
                        visible: false
                    }
                });
            }

        },

        _loadEmailTemplateKPI: function () {
            var oModel = this.getOwnerComponent().getModel();

            var oJSONModel = new sap.ui.model.json.JSONModel({
                emailtemplate: {
                    totalTemplates: 0,
                    activeTemplates: 0,
                    draftTemplates: 0,
                    usageRate: "0"
                },

                emaillog: {
                    totalEmailSent: 0,
                    totalSuccess: 0,
                    totalFailed: 0,
                    totalInProcess: 0
                },

                    charts: {
                    templateByCategory: [],
                    emailHealth: [],
                    emailTrafficByMonth: [],
                    topUsedTemplates: []
                }
            });

            this.getView().setModel(oJSONModel, "dashboard");

            // 👉 Total
            oModel.read("/EmailHeader/$count", {
                success: function (oData) {
                    oJSONModel.setProperty("/emailtemplate/totalTemplates", parseInt(oData));
                }
            });

            // 👉 Active (đã activate)
            oModel.read("/EmailHeader/$count", {
                urlParameters: {
                    "$filter": "IsActiveEntity eq true"
                },
                success: function (oData) {
                    oJSONModel.setProperty("/emailtemplate/activeTemplates", parseInt(oData));
                }
            });

            // 👉 Draft
            oModel.read("/EmailHeader/$count", {
                urlParameters: {
                    "$filter": "IsActiveEntity eq false"
                },
                success: function (oData) {
                    oJSONModel.setProperty("/emailtemplate/draftTemplates", parseInt(oData));
                }
            });
        },

        _loadEmailLogKPI: function () {
            var oModel = this.getOwnerComponent().getModel();
            var oJSONModel = this.getView().getModel("dashboard");

            oModel.read("/Statistic", {
                success: function (oData) {
                    var aResults = oData.results || [];

                    var iTotal = 0;
                    var iSuccess = 0;
                    var iFailed = 0;
                    var iOpen = 0;
                    var iUsedTemplates = 0;

                    var aTopUsedTemplates = [];

                    aResults.forEach(function (item) {
                        var iTemplateEmails = item.TotalEmails || 0;

                        iTotal += iTemplateEmails;
                        iSuccess += item.TotalSuccess || 0;
                        iFailed += item.TotalFailed || 0;
                        iOpen += item.TotalOpen || 0;

                        if (iTemplateEmails > 0) {
                            iUsedTemplates++;
                        }

                        aTopUsedTemplates.push({
                            templateName: item.TemplateName || "Unknown Template",
                            value: iTemplateEmails
                        });
                    });

                    // KPI
                    oJSONModel.setProperty("/emaillog/totalEmailSent", iTotal);
                    oJSONModel.setProperty("/emaillog/totalSuccess", iSuccess);
                    oJSONModel.setProperty("/emaillog/totalFailed", iFailed);
                    oJSONModel.setProperty("/emaillog/totalInProcess", iOpen);

                    // Usage rate
                    var iActiveTemplates = oJSONModel.getProperty("/emailtemplate/activeTemplates") || 0;
                    var fUsageRate = 0;

                    if (iActiveTemplates > 0) {
                        fUsageRate = (iUsedTemplates / iActiveTemplates) * 100;
                    }

                    oJSONModel.setProperty("/emailtemplate/usageRate", fUsageRate.toFixed(1));

                    // Email health donut
                    oJSONModel.setProperty("/charts/emailHealth", [
                        {
                            status: "Success",
                            value: iSuccess
                        },
                        {
                            status: "Failed",
                            value: iFailed
                        },
                        {
                            status: "In Process",
                            value: iOpen
                        }
                    ]);

                    // Top used templates bar chart
                    aTopUsedTemplates = aTopUsedTemplates
                        .filter(function (item) {
                            return item.value > 0;
                        })
                        .sort(function (a, b) {
                            return b.value - a.value;
                        })
                        .slice(0, 5);

                    oJSONModel.setProperty("/charts/topUsedTemplates", aTopUsedTemplates);
                },
                error: function (oError) {
                    console.error("Error loading Statistic", oError);
                    oJSONModel.setProperty("/charts/emailHealth", []);
                    oJSONModel.setProperty("/charts/topUsedTemplates", []);
                }
            });
        },

        _loadTemplateByCategoryChart: function () {
            var oModel = this.getOwnerComponent().getModel();
            var oJSONModel = this.getView().getModel("dashboard");

            oModel.read("/EmailHeader", {
                success: function (oData) {
                    var aResults = oData.results || [];
                    var mCategoryCount = {};
                    var aChartData = [];

                    aResults.forEach(function (item) {
                        var sCategory = item.Category || "Others";

                        if (!mCategoryCount[sCategory]) {
                            mCategoryCount[sCategory] = 0;
                        }

                        mCategoryCount[sCategory]++;
                    });

                    Object.keys(mCategoryCount).forEach(function (sCategory) {
                        aChartData.push({
                            category: sCategory,
                            value: mCategoryCount[sCategory]
                        });
                    });

                    oJSONModel.setProperty("/charts/templateByCategory", aChartData);

                    
                },
                error: function (oError) {
                    console.error("Error loading Template by Category chart", oError);
                    oJSONModel.setProperty("/charts/templateByCategory", []);
                }
            });
        },

        _loadEmailTrafficByMonthChart: function () {
            var oModel = this.getOwnerComponent().getModel();
            var oJSONModel = this.getView().getModel("dashboard");

            oModel.read("/EmailLog", {
                success: function (oData) {
                    var aResults = oData.results || [];
                    var mMonthCount = {};
                    var aChartData = [];

                    aResults.forEach(function (item) {
                        if (!item.SentDate) {
                            return;
                        }

                        var oDate = item.SentDate;

                        // OData V2 Date format: /Date(1711929600000)/
                        if (typeof oDate === "string" && oDate.indexOf("/Date(") === 0) {
                            oDate = new Date(parseInt(oDate.replace(/[^0-9]/g, ""), 10));
                        } else {
                            oDate = new Date(oDate);
                        }

                        if (isNaN(oDate.getTime())) {
                            return;
                        }

                        var iMonth = oDate.getMonth() + 1;
                        var iYear = oDate.getFullYear();

                        var sMonthKey = iYear + "-" + (iMonth < 10 ? "0" + iMonth : iMonth);

                        if (!mMonthCount[sMonthKey]) {
                            mMonthCount[sMonthKey] = 0;
                        }

                        mMonthCount[sMonthKey]++;
                    });

                    Object.keys(mMonthCount)
                        .sort()
                        .forEach(function (sMonthKey) {
                            aChartData.push({
                                month: sMonthKey,
                                value: mMonthCount[sMonthKey]
                            });
                        });

                    oJSONModel.setProperty("/charts/emailTrafficByMonth", aChartData);
                },
                error: function (oError) {
                    console.error("Error loading Email traffic by month", oError);
                    oJSONModel.setProperty("/charts/emailTrafficByMonth", []);
                }
            });
        },
    });
});