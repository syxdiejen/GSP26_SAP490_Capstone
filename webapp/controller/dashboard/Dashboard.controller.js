sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "zemail/template/app/util/ErrorHandler"
], function (Controller, JSONModel, ErrorHandler) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.dashboard.Dashboard", {

        // ======================
        // Lifecycle
        // ======================

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
                        title: { visible: true, text: this._getText("emails") }
                    },
                    categoryAxis: {
                        title: { visible: true, text: this._getText("month") }
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

        // ======================
        // KPI Loading
        // ======================

        _loadEmailTemplateKPI: function () {
            var oModel = this.getOwnerComponent().getModel();

            var oJSONModel = new JSONModel({
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

            oModel.read("/EmailHeader/$count", {
                success: function (oData) {
                    oJSONModel.setProperty("/emailtemplate/totalTemplates", parseInt(oData));
                }
            });

            oModel.read("/EmailHeader/$count", {
                urlParameters: {
                    "$filter": "IsActiveEntity eq true"
                },
                success: function (oData) {
                    oJSONModel.setProperty("/emailtemplate/activeTemplates", parseInt(oData));
                }
            });

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
                            templateName: item.TemplateName || this._getText("unknownTemplate"),
                            value: iTemplateEmails
                        });
                    }.bind(this));

                    oJSONModel.setProperty("/emaillog/totalEmailSent", iTotal);
                    oJSONModel.setProperty("/emaillog/totalSuccess", iSuccess);
                    oJSONModel.setProperty("/emaillog/totalFailed", iFailed);
                    oJSONModel.setProperty("/emaillog/totalInProcess", iOpen);

                    var iActiveTemplates = oJSONModel.getProperty("/emailtemplate/activeTemplates") || 0;
                    var fUsageRate = 0;

                    if (iActiveTemplates > 0) {
                        fUsageRate = (iUsedTemplates / iActiveTemplates) * 100;
                    }

                    oJSONModel.setProperty("/emailtemplate/usageRate", fUsageRate.toFixed(1));

                    oJSONModel.setProperty("/charts/emailHealth", [
                        {
                            status: this._getText("success"),
                            value: iOpen
                        },
                        {
                            status: this._getText("failed"),
                            value: iFailed
                        },
                        {
                            status: this._getText("inProcess"),
                            value: iSuccess
                        }
                    ]);

                    aTopUsedTemplates = aTopUsedTemplates
                        .filter(function (item) {
                            return item.value > 0;
                        })
                        .sort(function (a, b) {
                            return b.value - a.value;
                        })
                        .slice(0, 5);

                    oJSONModel.setProperty("/charts/topUsedTemplates", aTopUsedTemplates);
                }.bind(this),

                error: function (oError) {
                    ErrorHandler.show(oError, this._getBundle(), "dashboardStatisticLoadFailed");
                    oJSONModel.setProperty("/charts/emailHealth", []);
                    oJSONModel.setProperty("/charts/topUsedTemplates", []);
                }.bind(this)
            });
        },

        // ======================
        // Chart Loading
        // ======================

        _loadTemplateByCategoryChart: function () {
            var oModel = this.getOwnerComponent().getModel();
            var oJSONModel = this.getView().getModel("dashboard");

            oModel.read("/EmailHeader", {
                success: function (oData) {
                    var aResults = oData.results || [];
                    var mCategoryCount = {};
                    var aChartData = [];

                    aResults.forEach(function (item) {
                        var sCategory = item.Category || this._getText("others");

                        if (!mCategoryCount[sCategory]) {
                            mCategoryCount[sCategory] = 0;
                        }

                        mCategoryCount[sCategory]++;
                    }.bind(this));

                    Object.keys(mCategoryCount).forEach(function (sCategory) {
                        aChartData.push({
                            category: sCategory,
                            value: mCategoryCount[sCategory]
                        });
                    });

                    oJSONModel.setProperty("/charts/templateByCategory", aChartData);
                }.bind(this),

                error: function (oError) {
                    ErrorHandler.show(oError, this._getBundle(), "dashboardTemplateCategoryLoadFailed");
                    oJSONModel.setProperty("/charts/templateByCategory", []);
                }.bind(this)
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
                    ErrorHandler.show(oError, this._getBundle(), "dashboardEmailTrafficLoadFailed");
                    oJSONModel.setProperty("/charts/emailTrafficByMonth", []);
                }.bind(this)
            });
        },

        // ======================
        // i18n Helpers
        // ======================

        _getBundle: function () {
            return this.getOwnerComponent()
                .getModel("i18n")
                .getResourceBundle();
        },

        _getText: function (sKey, aArgs) {
            return this._getBundle().getText(sKey, aArgs);
        }

    });
});