﻿// <auto-generated />
using System;
using BlazorQuestionarioServer.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

#nullable disable

namespace BlazorQuestionarioServer.Migrations
{
    [DbContext(typeof(ApplicationDbContext))]
    [Migration("20220704084551_initial")]
    partial class initial
    {
        protected override void BuildTargetModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "6.0.3")
                .HasAnnotation("Relational:MaxIdentifierLength", 128);

            SqlServerModelBuilderExtensions.UseIdentityColumns(modelBuilder, 1L, 1);

            modelBuilder.Entity("BlazorAppTest.Shared.QuestionarioTest", b =>
                {
                    b.Property<Guid>("QuestionarioTestId")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uniqueidentifier");

                    b.Property<string>("ArgomentiProxEvento")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("Cognome")
                        .IsRequired()
                        .HasMaxLength(50)
                        .HasColumnType("nvarchar(50)");

                    b.Property<DateTime>("Data")
                        .HasColumnType("datetime2");

                    b.Property<string>("EMail")
                        .IsRequired()
                        .HasMaxLength(250)
                        .HasColumnType("nvarchar(250)");

                    b.Property<string>("Nome")
                        .IsRequired()
                        .HasMaxLength(50)
                        .HasColumnType("nvarchar(50)");

                    b.Property<int>("Track01Valutazione")
                        .HasColumnType("int");

                    b.Property<Guid>("Track01WorkshopTrackId")
                        .HasColumnType("uniqueidentifier");

                    b.Property<int>("Track02Valutazione")
                        .HasColumnType("int");

                    b.Property<Guid>("Track02WorkshopTrackId")
                        .HasColumnType("uniqueidentifier");

                    b.Property<int>("Track03Valutazione")
                        .HasColumnType("int");

                    b.Property<Guid>("Track03WorkshopTrackId")
                        .HasColumnType("uniqueidentifier");

                    b.Property<int>("Track04Valutazione")
                        .HasColumnType("int");

                    b.Property<Guid>("Track04WorkshopTrackId")
                        .HasColumnType("uniqueidentifier");

                    b.Property<int>("Track05Valutazione")
                        .HasColumnType("int");

                    b.Property<Guid>("Track05WorkshopTrackId")
                        .HasColumnType("uniqueidentifier");

                    b.Property<int>("UtilitaInformazioniRicevute")
                        .HasColumnType("int");

                    b.Property<int>("ValutazioneQualitaGeneraleEvento")
                        .HasColumnType("int");

                    b.Property<Guid>("WorkshopId")
                        .HasColumnType("uniqueidentifier");

                    b.HasKey("QuestionarioTestId");

                    b.ToTable("QuestionarioTest");
                });

            modelBuilder.Entity("BlazorAppTest.Shared.Workshop", b =>
                {
                    b.Property<Guid>("WorkshopId")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uniqueidentifier");

                    b.Property<string>("BlogHtml")
                        .HasColumnType("nvarchar(max)");

                    b.Property<DateTime>("CreationDate")
                        .HasColumnType("datetime2");

                    b.Property<string>("Description")
                        .HasColumnType("nvarchar(max)");

                    b.Property<DateTime>("EventDate")
                        .HasColumnType("datetime2");

                    b.Property<bool>("ExternalRegistration")
                        .HasColumnType("bit");

                    b.Property<string>("ExternalRegistrationLink")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("Image")
                        .HasColumnType("nvarchar(max)");

                    b.Property<bool>("IsExternalEvent")
                        .HasColumnType("bit");

                    b.Property<bool>("OnlyHtml")
                        .HasColumnType("bit");

                    b.Property<bool>("Published")
                        .HasColumnType("bit");

                    b.Property<string>("Tags")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("Title")
                        .HasColumnType("nvarchar(max)");

                    b.HasKey("WorkshopId");

                    b.ToTable("Workshop");
                });

            modelBuilder.Entity("BlazorAppTest.Shared.WorkshopCorrente", b =>
                {
                    b.Property<Guid>("WorkshopId")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uniqueidentifier");

                    b.HasKey("WorkshopId");

                    b.ToTable("WorkshopCorrente");
                });

            modelBuilder.Entity("BlazorAppTest.Shared.WorkshopSpeaker", b =>
                {
                    b.Property<Guid>("WorkshopSpeakerId")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uniqueidentifier");

                    b.Property<string>("BlogHtml")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("Name")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("ProfileImage")
                        .HasColumnType("nvarchar(max)");

                    b.Property<string>("UserName")
                        .HasColumnType("nvarchar(max)");

                    b.HasKey("WorkshopSpeakerId");

                    b.ToTable("WorkshopSpeaker");
                });

            modelBuilder.Entity("BlazorAppTest.Shared.WorkshopTrack", b =>
                {
                    b.Property<Guid>("WorkshopTrackId")
                        .ValueGeneratedOnAdd()
                        .HasColumnType("uniqueidentifier");

                    b.Property<string>("Abstract")
                        .HasColumnType("nvarchar(max)");

                    b.Property<DateTime>("EndTime")
                        .HasColumnType("datetime2");

                    b.Property<string>("Image")
                        .HasColumnType("nvarchar(max)");

                    b.Property<int>("Level")
                        .HasColumnType("int");

                    b.Property<DateTime>("StartTime")
                        .HasColumnType("datetime2");

                    b.Property<string>("Title")
                        .HasColumnType("nvarchar(max)");

                    b.Property<Guid>("WorkshopId")
                        .HasColumnType("uniqueidentifier");

                    b.HasKey("WorkshopTrackId");

                    b.HasIndex("WorkshopId");

                    b.ToTable("WorkshopTrack");
                });

            modelBuilder.Entity("BlazorAppTest.Shared.WorkshopTrackWorkshopSpeaker", b =>
                {
                    b.Property<Guid>("WorkshopTrackWorkshopTrackId")
                        .HasColumnType("uniqueidentifier")
                        .HasColumnName("WorkshopTrack_WorkshopTrackId");

                    b.Property<Guid>("WorkshopSpeakerWorkshopSpeakerId")
                        .HasColumnType("uniqueidentifier")
                        .HasColumnName("WorkshopSpeaker_WorkshopSpeakerId");

                    b.HasKey("WorkshopTrackWorkshopTrackId", "WorkshopSpeakerWorkshopSpeakerId");

                    b.HasIndex("WorkshopSpeakerWorkshopSpeakerId");

                    b.ToTable("WorkshopTrackWorkshopSpeaker");
                });

            modelBuilder.Entity("BlazorAppTest.Shared.WorkshopTrack", b =>
                {
                    b.HasOne("BlazorAppTest.Shared.Workshop", "Workshop")
                        .WithMany("WorkshopTracks")
                        .HasForeignKey("WorkshopId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("Workshop");
                });

            modelBuilder.Entity("BlazorAppTest.Shared.WorkshopTrackWorkshopSpeaker", b =>
                {
                    b.HasOne("BlazorAppTest.Shared.WorkshopSpeaker", "WorkshopSpeakerWorkshopSpeaker")
                        .WithMany()
                        .HasForeignKey("WorkshopSpeakerWorkshopSpeakerId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.HasOne("BlazorAppTest.Shared.WorkshopTrack", "WorkshopTrackWorkshopTrack")
                        .WithMany("ListaWorkshopTrackWorkshopSpeaker")
                        .HasForeignKey("WorkshopTrackWorkshopTrackId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired();

                    b.Navigation("WorkshopSpeakerWorkshopSpeaker");

                    b.Navigation("WorkshopTrackWorkshopTrack");
                });

            modelBuilder.Entity("BlazorAppTest.Shared.Workshop", b =>
                {
                    b.Navigation("WorkshopTracks");
                });

            modelBuilder.Entity("BlazorAppTest.Shared.WorkshopTrack", b =>
                {
                    b.Navigation("ListaWorkshopTrackWorkshopSpeaker");
                });
#pragma warning restore 612, 618
        }
    }
}