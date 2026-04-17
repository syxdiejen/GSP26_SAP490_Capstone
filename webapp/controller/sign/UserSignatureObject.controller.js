sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/BusyIndicator",
  "sap/m/MessageBox",
  "sap/m/MessageToast",
  "sap/ui/core/routing/History"
], function (
  Controller,
  JSONModel,
  BusyIndicator,
  MessageBox,
  MessageToast,
  History
) {
  "use strict";

  return Controller.extend("zemail.template.app.controller.sign.UserSignatureObject", {
    onInit: function () {
      this.getView().setModel(new JSONModel({
        title: "Create Signature",
        isCreate: true
      }), "viewState");

      this.getOwnerComponent().getRouter().getRoute("signobject")
        .attachPatternMatched(this._onObjectMatched, this);

      this.getOwnerComponent().getRouter().getRoute("signcreate")
        .attachPatternMatched(this._onCreateMatched, this);
    },

    _onCreateMatched: function () {
      var oJson = new JSONModel({
        SignId: "",
        OwnerId: "",
        SignName: "",
        IsDefault: false,
        Content: "",
        IsActiveEntity: false
      });

      this.getView().setModel(oJson, "sign");
      this.getView().getModel("viewState").setData({
        title: "Create Signature",
        isCreate: true
      });
    },

    _onObjectMatched: function (oEvent) {
        var oArgs = oEvent.getParameter("arguments");
        var sSignId = decodeURIComponent(oArgs.SignId || "");
        var bIsActiveEntity = oArgs.IsActiveEntity === "true";
        var oModel = this.getOwnerComponent().getModel();

        var sPath = oModel.createKey("/UserSignature", {
            SignId: sSignId,
            IsActiveEntity: bIsActiveEntity
        });

        this.getView().bindElement({
            path: sPath,
            model: undefined,
            events: {
            dataRequested: function () {
                sap.ui.core.BusyIndicator.show(0);
            },
            dataReceived: function () {
                sap.ui.core.BusyIndicator.hide();
            }
            }
        });

        this.getView().getModel("viewState").setData({
            title: bIsActiveEntity ? "Display Signature" : "Edit Signature",
            isCreate: false
        });
        },

    onSavePress: function () {
      var oData = this.getView().getModel("sign").getData();
      var oModel = this.getOwnerComponent().getModel();
      var that = this;

      if (!oData.SignName) {
        MessageBox.warning("Vui lòng nhập tên chữ ký");
        return;
      }

      if (!oData.Content) {
        MessageBox.warning("Vui lòng nhập nội dung chữ ký");
        return;
      }

      BusyIndicator.show(0);

      if (!oData.SignId) {
        oModel.create("/UserSignature", {
          SignName: oData.SignName,
          IsDefault: oData.IsDefault,
          Content: oData.Content
        }, {
          success: function (oCreated) {
            BusyIndicator.hide();
            MessageToast.show("Đã lưu draft");
            that.getOwnerComponent().getRouter().navTo("signobject", {
              SignId: encodeURIComponent(oCreated.SignId),
              IsActiveEntity: oCreated.IsActiveEntity
            }, true);
          },
          error: function () {
            BusyIndicator.hide();
            MessageBox.error("Lưu draft thất bại");
          }
        });
      } else {
        var sPath = oModel.createKey("/UserSignature", {
          SignId: oData.SignId,
          IsActiveEntity: oData.IsActiveEntity
        });

        oModel.update(sPath, {
          SignName: oData.SignName,
          IsDefault: oData.IsDefault,
          Content: oData.Content
        }, {
          success: function () {
            BusyIndicator.hide();
            MessageToast.show("Đã cập nhật draft");
          },
          error: function () {
            BusyIndicator.hide();
            MessageBox.error("Cập nhật thất bại");
          }
        });
      }
    },

        onActivatePress: function () {
        var oCtx = this.getView().getBindingContext();
        var oObj = oCtx.getObject();
        var oModel = this.getOwnerComponent().getModel();
        var oRouter = this.getOwnerComponent().getRouter();

        sap.ui.core.BusyIndicator.show(0);

        oModel.callFunction("/UserSignatureActivate", {
            method: "POST",
            urlParameters: {
            SignId: oObj.SignId,
            IsActiveEntity: false
            },
            success: function () {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageToast.show("Publish thành công");
            oRouter.navTo("signlist");
            },
            error: function () {
            sap.ui.core.BusyIndicator.hide();
            sap.m.MessageBox.error("Publish thất bại");
            }
        });
        },

    onDeletePress: function () {
      var oData = this.getView().getModel("sign").getData();
      var oModel = this.getOwnerComponent().getModel();
      var that = this;

      MessageBox.confirm("Bạn có chắc muốn xóa chữ ký này?", {
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) {
            return;
          }

          var sPath = oModel.createKey("/UserSignature", {
            SignId: oData.SignId,
            IsActiveEntity: oData.IsActiveEntity
          });

          oModel.remove(sPath, {
            success: function () {
              MessageToast.show("Xóa thành công");
              that.getOwnerComponent().getRouter().navTo("signlist");
            },
            error: function () {
              MessageBox.error("Xóa thất bại");
            }
          });
        }
      });
    },

    onCancelPress: function () {
      var oHistory = History.getInstance();
      var sPrevHash = oHistory.getPreviousHash();

      if (sPrevHash !== undefined) {
        window.history.go(-1);
      } else {
        this.getOwnerComponent().getRouter().navTo("signlist");
      }
    },

    onSignNameChange: function () {
        var bIsCreate = this.getView().getModel("viewState").getProperty("/isCreate");
        this.getView().getModel("viewState").setProperty(
            "/title",
            bIsCreate ? "Create Signature" : "Edit Signature"
        );
    }
  });
});