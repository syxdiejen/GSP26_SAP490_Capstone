sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageBox",
  "sap/m/MessageToast"
], function (
  Controller,
  JSONModel,
  Filter,
  FilterOperator,
  MessageBox,
  MessageToast
) {
  "use strict";

  return Controller.extend("zemail.template.app.controller.sign.UserSignatureList", {
    onInit: function () {
      this.getView().setModel(new JSONModel({
        UserSignature: []
      }), "sign");

      this._loadData();
    },

    _loadData: function () {
      var oModel = this.getOwnerComponent().getModel();
      var oJson = this.getView().getModel("sign");

      oModel.read("/UserSignature", {
        urlParameters: {
          "$format": "json"
        },
        success: function (oData) {
          oJson.setProperty("/UserSignature", oData.results || []);
        },
        error: function () {
          MessageBox.error("Không tải được danh sách chữ ký.");
        }
      });
    },

    onCreatePress: function () {
        var oModel = this.getOwnerComponent().getModel();
        var oRouter = this.getOwnerComponent().getRouter();

        sap.ui.core.BusyIndicator.show(0);

        oModel.create("/UserSignature", {
            SignName: "",
            IsDefault: false,
            Content: ""
        }, {
            success: function (oCreated) {
            sap.ui.core.BusyIndicator.hide();

            oRouter.navTo("signobject", {
                SignId: encodeURIComponent(oCreated.SignId),
                IsActiveEntity: "false"
            });
            },
            error: function () {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageBox.error("Không tạo được draft chữ ký.");
            }
        });
        },

    onItemPress: function (oEvent) {
      var oCtx = oEvent.getSource().getBindingContext("sign");
      var oObj = oCtx.getObject();

      this.getOwnerComponent().getRouter().navTo("signobject", {
        SignId: encodeURIComponent(oObj.SignId),
        IsActiveEntity: oObj.IsActiveEntity
      });
    },

        onEditPress: function (oEvent) {
        oEvent.stopPropagation();

        var oCtx = oEvent.getSource().getParent().getParent().getBindingContext("sign");
        var oObj = oCtx.getObject();
        var oModel = this.getOwnerComponent().getModel();
        var oRouter = this.getOwnerComponent().getRouter();

        if (oObj.IsActiveEntity === false) {
            oRouter.navTo("signobject", {
            SignId: encodeURIComponent(oObj.SignId),
            IsActiveEntity: "false"
            });
            return;
        }

        sap.ui.core.BusyIndicator.show(0);

        oModel.callFunction("/UserSignatureEdit", {
            method: "POST",
            urlParameters: {
            SignId: oObj.SignId,
            IsActiveEntity: true,
            PreserveChanges: true
            },
            success: function (oData) {
            sap.ui.core.BusyIndicator.hide();

            oRouter.navTo("signobject", {
                SignId: encodeURIComponent(oData.SignId),
                IsActiveEntity: "false"
            });
            },
            error: function () {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageBox.error("Không tạo được draft để edit.");
            }
        });
        },

    onDeletePress: function (oEvent) {
      oEvent.stopPropagation();

      var oCtx = oEvent.getSource().getParent().getParent().getBindingContext("sign");
      var oObj = oCtx.getObject();
      var oModel = this.getOwnerComponent().getModel();
      var that = this;

      MessageBox.confirm("Bạn có chắc muốn xóa chữ ký này?", {
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) {
            return;
          }

          var sPath = oModel.createKey("/UserSignature", {
            SignId: oObj.SignId,
            IsActiveEntity: oObj.IsActiveEntity
          });

          oModel.remove(sPath, {
            success: function () {
              MessageToast.show("Xóa thành công");
              that._loadData();
            },
            error: function () {
              MessageBox.error("Xóa thất bại");
            }
          });
        }
      });
    },

    onSearch: function () {
    },

    onDefaultChange: function () {
    },

    onGoPress: function () {
      var sKeyword = this.byId("searchField").getValue();
      var sType = this.byId("defaultFilter").getSelectedKey();
      var aData = this.getView().getModel("sign").getProperty("/UserSignature") || [];

      var aFiltered = aData.filter(function (oItem) {
        var bMatchKeyword = !sKeyword ||
          (oItem.SignName || "").toLowerCase().indexOf(sKeyword.toLowerCase()) !== -1;

        var bMatchType = true;
        if (sType === "DEFAULT") {
          bMatchType = oItem.IsDefault === true;
        } else if (sType === "NONDEFAULT") {
          bMatchType = oItem.IsDefault === false;
        } else if (sType === "DRAFT") {
          bMatchType = oItem.IsActiveEntity === false;
        }

        return bMatchKeyword && bMatchType;
      });

      this.getView().getModel("sign").setProperty("/UserSignature", aFiltered);
    }
  });
});