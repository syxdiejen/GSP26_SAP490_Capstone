sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.dashboard.Dashboard", {

        onInit: function () {
            const oModel = this.getOwnerComponent().getModel();
            const aLogs = oModel.getProperty("/logs");

            if (aLogs && aLogs.length) {
                this._buildDashboardData(aLogs);
            } else {
                oModel.attachRequestCompleted(() => {
                    this._buildDashboardData(oModel.getProperty("/logs") || []);
                });
            }
        },

        _buildDashboardData: function (aLogs) {
            const oModel = this.getOwnerComponent().getModel();

            const iTotal = aLogs.length;
            const iSuccess = aLogs.filter(function (oItem) {
                return oItem.Status === "SUCCESS";
            }).length;
            const iFailed = aLogs.filter(function (oItem) {
                return oItem.Status === "FAILED";
            }).length;

            const aStatusData = [
                { Status: "Success", Count: iSuccess },
                { Status: "Failed", Count: iFailed }
            ];

            const aDailyData = this._buildDailyStats(aLogs);
            const aTemplateUsage = this._buildTemplateUsage(aLogs);
            const aRecentLogs = this._buildRecentLogs(aLogs, 8);

            oModel.setProperty("/dashboard", {
                summary: {
                    total: iTotal,
                    success: iSuccess,
                    failed: iFailed
                },
                statusData: aStatusData,
                dailyData: aDailyData,
                templateUsage: aTemplateUsage,
                recentLogs: aRecentLogs
            });
        },

        _buildDailyStats: function (aLogs) {
            const mDaily = {};

            aLogs.forEach(function (oLog) {
                const sDate = oLog.SentAt.slice(0, 10);

                if (!mDaily[sDate]) {
                    mDaily[sDate] = {
                        Date: sDate,
                        Count: 0
                    };
                }

                mDaily[sDate].Count += 1;
            });

            return Object.keys(mDaily).sort().map(function (sKey) {
                return mDaily[sKey];
            });
        },

        _buildTemplateUsage: function (aLogs) {
            const mTemplates = {};

            aLogs.forEach(function (oLog) {
                if (!mTemplates[oLog.TemplateName]) {
                    mTemplates[oLog.TemplateName] = {
                        TemplateName: oLog.TemplateName,
                        Count: 0
                    };
                }

                mTemplates[oLog.TemplateName].Count += 1;
            });

            return Object.keys(mTemplates)
                .map(function (sKey) {
                    return mTemplates[sKey];
                })
                .sort(function (a, b) {
                    return b.Count - a.Count;
                });
        },

        _buildRecentLogs: function (aLogs, iLimit) {
            return aLogs.slice().sort(function (a, b) {
                return new Date(b.SentAt) - new Date(a.SentAt);
            }).slice(0, iLimit);
        },

        formatStatusState: function (sStatus) {
            if (sStatus === "SUCCESS") {
                return "Success";
            }
            if (sStatus === "FAILED") {
                return "Error";
            }
            return "None";
        }
    });
});