sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/Label",
    "sap/m/MessageStrip",
    "sap/ui/core/HTML"
], function (
    Controller,
    Dialog,
    Button,
    VBox,
    HBox,
    Text,
    Title,
    Label,
    MessageStrip,
    HTML
) {
    "use strict";

    return Controller.extend("zemail.template.app.controller.logs.EmailLogs", {

        onInit: function () {
            const oModel = this.getOwnerComponent().getModel();
            const aLogs = oModel.getProperty("/logs");

            if (aLogs && aLogs.length) {
                oModel.setProperty("/filteredLogs", aLogs);
            } else {
                oModel.attachRequestCompleted(() => {
                    oModel.setProperty("/filteredLogs", oModel.getProperty("/logs"));
                });
            }
        },

        onFilterByDate: function(oEvent) {
            const sDate = oEvent.getSource().getValue();
            const oModel = this.getOwnerComponent().getModel();
            const aLogs = oModel.getProperty("/logs");
            const aFiltered = aLogs.filter(log => log.SentAt === sDate);

            oModel.setProperty("/filteredLogs", aFiltered);
            oModel.setProperty("/filterDate", sDate);
        },

        onClearFilter: function() {
            const oModel = this.getOwnerComponent().getModel();
            const aLogs = oModel.getProperty("/logs");

            oModel.setProperty("/filteredLogs", aLogs);
            oModel.setProperty("/filterDate", "");
        },

        onViewDetail: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext();
            const oLog = oContext.getObject();

            const sRecipient = oLog.Recipient || "-";
            const sStatus = oLog.Status || "-";
            const sSentAt = oLog.SentAt || "-";
            const sEmailContent = oLog.EmailContent || oLog.Content || oLog.Body || "No email content available.";
            const sErrorMessage = oLog.ErrorMessage || oLog.Message || "";

            if (!this._oDetailDialog) {
                this._oDetailDialog = new Dialog({
                    title: "Email Log Detail",
                    contentWidth: "720px",
                    contentHeight: "500px",
                    resizable: true,
                    draggable: true,
                    verticalScrolling: true,
                    content: [],
                    endButton: new Button({
                        text: "Close",
                        press: function () {
                            this._oDetailDialog.close();
                        }.bind(this)
                    })
                });

                this.getView().addDependent(this._oDetailDialog);
            }

            const aContent = [
                new VBox({
                    width: "100%",
                    items: [
                        new Title({ text: "General Information", level: "H4" }),

                        new HBox({
                            items: [
                                new Label({ text: "Recipient:", width: "120px" }),
                                new Text({ text: sRecipient })
                            ]
                        }).addStyleClass("sapUiSmallMarginBottom"),

                        new HBox({
                            items: [
                                new Label({ text: "Status:", width: "120px" }),
                                new Text({ text: sStatus })
                            ]
                        }).addStyleClass("sapUiSmallMarginBottom"),

                        new HBox({
                            items: [
                                new Label({ text: "Sent At:", width: "120px" }),
                                new Text({ text: sSentAt })
                            ]
                        }).addStyleClass("sapUiSmallMarginBottom sapUiMediumMarginBottom"),

                        new Title({ text: "Email Content", level: "H4" }),

                        new HTML({
                            content:
                                "<div style='padding:0.75rem;border:1px solid #d9d9d9;border-radius:0.5rem;max-height:220px;overflow:auto;white-space:pre-wrap;word-break:break-word;'>" +
                                this._escapeHtml(sEmailContent) +
                                "</div>"
                        }).addStyleClass("sapUiSmallMarginBottom")
                    ]
                })
            ];

            if (sStatus !== "SUCCESS" && sErrorMessage) {
                aContent.push(
                    new VBox({
                        items: [
                            new Title({ text: "Error Detail", level: "H4" }),
                            new MessageStrip({
                                text: sErrorMessage,
                                type: "Error",
                                showIcon: true
                            })
                        ]
                    }).addStyleClass("sapUiMediumMarginTop")
                );
            }

            this._oDetailDialog.removeAllContent();
            aContent.forEach(function (oItem) {
                this._oDetailDialog.addContent(oItem);
            }.bind(this));

            this._oDetailDialog.open();
        },

        _escapeHtml: function (sText) {
            return String(sText)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#39;");
        },

        onFilterChange: function () {
    const oView = this.getView();
    const oModel = this.getOwnerComponent().getModel();
    const aLogs = oModel.getProperty("/logs") || [];

    const oSearchField = oView.findAggregatedObjects(true, o => o.isA("sap.m.SearchField"))[0];
    const oStatusBox = oView.findAggregatedObjects(true, o => o.isA("sap.m.MultiComboBox"))[0];
    const oDateRange = oView.findAggregatedObjects(true, o => o.isA("sap.m.DateRangeSelection"))[0];

    const sKeyword = (oSearchField?.getValue() || "").trim().toLowerCase();
    const aStatuses = oStatusBox?.getSelectedKeys() || [];
    const dFrom = oDateRange?.getDateValue();
    const dTo = oDateRange?.getSecondDateValue() || dFrom;

    const aFiltered = aLogs.filter(function (oLog) {
        const sRecipient = (oLog.Recipient || "").toLowerCase();
        const sStatus = oLog.Status || "";
        const dSentAt = oLog.SentAt ? new Date(oLog.SentAt) : null;

        const bRecipient = !sKeyword || sRecipient.includes(sKeyword);
        const bStatus = aStatuses.length === 0 || aStatuses.includes(sStatus);

        let bDate = true;
        if (dFrom && dSentAt) {
            const dStart = new Date(dFrom);
            dStart.setHours(0, 0, 0, 0);

            const dEnd = new Date(dTo);
            dEnd.setHours(23, 59, 59, 999);

            bDate = dSentAt >= dStart && dSentAt <= dEnd;
        }

        return bRecipient && bStatus && bDate;
    });

    oModel.setProperty("/filteredLogs", aFiltered);
},

onClearFilter: function () {
    const oView = this.getView();
    const oModel = this.getOwnerComponent().getModel();

    const oSearchField = oView.findAggregatedObjects(true, o => o.isA("sap.m.SearchField"))[0];
    const oStatusBox = oView.findAggregatedObjects(true, o => o.isA("sap.m.MultiComboBox"))[0];
    const oDateRange = oView.findAggregatedObjects(true, o => o.isA("sap.m.DateRangeSelection"))[0];

    if (oSearchField) {
        oSearchField.setValue("");
    }
    if (oStatusBox) {
        oStatusBox.setSelectedKeys([]);
    }
    if (oDateRange) {
        oDateRange.setDateValue(null);
        oDateRange.setSecondDateValue(null);
        oDateRange.setValue("");
    }

    oModel.setProperty("/filteredLogs", oModel.getProperty("/logs") || []);
}

    });
});